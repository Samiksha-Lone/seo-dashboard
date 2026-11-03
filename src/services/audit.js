const { crawlWebsite } = require("../crawlers/website");
const { getPageSpeed } = require("../crawlers/pagespeed");
const { getGSCData } = require("../crawlers/gsc");
const { validateSchema } = require("../crawlers/schema");
const { analyzeOnPage } = require("../analyzers/on-page");
const { checkRobotsAndSitemap } = require("../crawlers/robots-sitemap");
const { getDataForSEO } = require("../crawlers/dataforseo");
const { generateSeoReport } = require("./claude");

function getErrorDetails(error) {
  return {
    name: error && error.name ? error.name : "Error",
    message: redactSecrets(
      error && error.message ? error.message : String(error),
    ),
  };
}

function redactSecrets(message) {
  let safeMessage = String(message);

  [process.env.ANTHROPIC_API_KEY, process.env.DATABASE_URL].forEach(
    (secret) => {
      if (secret) {
        safeMessage = safeMessage.split(secret).join("[REDACTED]");
      }
    },
  );

  return safeMessage
    .replace(/sk-ant-[A-Za-z0-9_-]+/g, "[REDACTED]")
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/(postgres(?:ql)?:\/\/)[^@\s]+@/gi, "$1[REDACTED]@");
}

async function collectSignal(signals, name, collect) {
  try {
    signals[name] = {
      status: "success",
      data: await collect(),
    };
  } catch (error) {
    signals[name] = {
      status: "error",
      error: getErrorDetails(error),
    };
  }
}

function validateAuditInput(url, options) {
  if (typeof url !== "string" || !url.trim()) {
    throw new TypeError("A valid HTTP or HTTPS URL is required.");
  }

  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("Audit options must be an object containing clientId.");
  }

  if (typeof options.clientId !== "string" || !options.clientId.trim()) {
    throw new TypeError(
      "An existing clientId is required for audit persistence. Call runAudit(url, { clientId }).",
    );
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url.trim());
  } catch {
    throw new TypeError("A valid HTTP or HTTPS URL is required.");
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new TypeError("The audit URL must use HTTP or HTTPS.");
  }

  if (parsedUrl.username || parsedUrl.password) {
    throw new TypeError("Audit URLs must not contain embedded credentials.");
  }

  return {
    auditUrl: parsedUrl.href,
    clientId: options.clientId.trim(),
    websiteName: parsedUrl.hostname,
  };
}

async function getPrismaClient() {
  const prismaModule = await import("../lib/prisma.js");
  return prismaModule.prisma;
}

async function persistAudit({
  prisma,
  clientId,
  auditId,
  auditUrl,
  websiteName,
  startedAt,
  signals,
  report,
}) {
  try {
    return await prisma.$transaction(
      async (transaction) => {
        let website;
        if (auditId) {
          const existingAudit = await transaction.audit.findUnique({
            where: { id: auditId },
            include: { website: { select: { id: true, clientId: true } } },
          });

          if (!existingAudit) {
            throw new Error(`Audit "${auditId}" was not found.`);
          }

          if (existingAudit.website.clientId !== clientId) {
            throw new Error(
              "Audit client does not match the requested client.",
            );
          }

          if (existingAudit.status === "COMPLETED") {
            throw new Error(`Audit "${auditId}" is already completed.`);
          }

          website = { id: existingAudit.website.id };
        } else {
          website = await transaction.website.findFirst({
            where: { clientId, url: auditUrl },
            select: { id: true },
          });

          if (!website) {
            website = await transaction.website.create({
              data: {
                name: websiteName,
                url: auditUrl,
                clientId,
              },
              select: { id: true },
            });
          }
        }

        const issueRecords = [
          ...report.critical_issues.map((issue) => ({
            ...issue,
            severity: "CRITICAL",
          })),
          ...report.important_issues.map((issue) => ({
            ...issue,
            severity: "IMPORTANT",
          })),
          ...report.quick_wins.map((issue) => ({
            ...issue,
            severity: "QUICK_WIN",
          })),
        ].map((issue) => ({
          severity: issue.severity,
          category: issue.category,
          title: issue.title,
          finding: issue.finding,
          fix: issue.fix,
          estimatedImpact: issue.estimated_impact,
          effort: issue.effort,
          falsifiabilityCheck: issue.falsifiability_check,
        }));

        const recommendationRecords = report.recommendations.map(
          (recommendation) => ({
            priority: recommendation.priority,
            category: recommendation.category,
            finding: recommendation.finding,
            fix: recommendation.fix,
            estimatedImpact: recommendation.estimated_impact,
            effort: recommendation.effort,
            falsifiabilityCheck: recommendation.falsifiability_check,
          }),
        );

        const auditData = {
          auditVersion: report.audit_version,
          status: "PROCESSING",
          overallScore: report.overall_score,
          scoreBreakdown: report.score_breakdown,
          result: report,
          signals,
          errorMessage: null,
          startedAt,
          completedAt: null,
          websiteId: website.id,
          issues: { create: issueRecords },
          recommendations: { create: recommendationRecords },
        };

        if (auditId) {
          await transaction.auditIssue.deleteMany({ where: { auditId } });
          await transaction.auditRecommendation.deleteMany({
            where: { auditId },
          });
          return transaction.audit.update({
            where: { id: auditId },
            data: auditData,
            include: {
              website: true,
              issues: true,
              recommendations: true,
              report: true,
            },
          });
        }

        return transaction.audit.create({
          data: auditData,
          include: {
            website: true,
            issues: true,
            recommendations: true,
            report: true,
          },
        });
      },
      { timeout: 20_000 },
    );
  } catch (error) {
    console.error("Audit persistence failed:", {
      name: error && error.name ? error.name : "Error",
      code: error && error.code ? error.code : null,
      message: redactSecrets(
        error && error.message ? error.message : String(error),
      ),
    });
    throw new Error(
      `Audit persistence failed: ${redactSecrets(error.message || String(error))}`,
    );
  }
}

async function runAudit(url, options = {}) {
  const { auditUrl, clientId, websiteName } = validateAuditInput(url, options);
  const auditId = options.auditId;
  if (
    auditId !== undefined &&
    (typeof auditId !== "string" || !auditId.trim())
  ) {
    throw new TypeError("auditId must be a non-empty string when provided.");
  }
  const prisma = await getPrismaClient();

  let client;
  try {
    client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        businessName: true,
        businessType: true,
        city: true,
        state: true,
      },
    });
  } catch (error) {
    console.error("Audit client lookup failed:", {
      name: error && error.name ? error.name : "Error",
      code: error && error.code ? error.code : null,
      message: redactSecrets(
        error && error.message ? error.message : String(error),
      ),
    });
    throw new Error(
      `Unable to verify audit client: ${redactSecrets(error.message || String(error))}`,
    );
  }

  if (!client) {
    throw new Error(`Client "${clientId}" was not found.`);
  }

  const startedAt = new Date();
  let websiteData;
  try {
    websiteData = await crawlWebsite(auditUrl);
  } catch (error) {
    const crawlError = new Error(
      `Website crawl failed: ${getErrorDetails(error).message}`,
    );
    crawlError.cause = error;
    throw crawlError;
  }

  const signals = {
    website: { status: "success", data: websiteData },
  };

  await collectSignal(signals, "pageSpeed", () => getPageSpeed(auditUrl));
  await collectSignal(signals, "googleSearchConsole", () => getGSCData());
  await collectSignal(signals, "schema", () =>
    validateSchema(websiteData && websiteData.structuredData),
  );
  await collectSignal(signals, "onPage", () => analyzeOnPage(websiteData));
  await collectSignal(signals, "robotsSitemap", () =>
    checkRobotsAndSitemap(auditUrl),
  );
  await collectSignal(signals, "dataForSEO", () => getDataForSEO());

  const hasSignalErrors = Object.values(signals).some(
    (signal) => signal.status === "error",
  );

  const report = await generateSeoReport(signals, {
    url: auditUrl,
    businessType: client.businessType,
    city: client.city,
    state: client.state,
  });

  const audit = await persistAudit({
    prisma,
    clientId,
    auditId: auditId && auditId.trim(),
    auditUrl,
    websiteName,
    startedAt,
    signals,
    report,
  });

  return {
    url: auditUrl,
    status: hasSignalErrors ? "completed_with_signal_errors" : "completed",
    signals,
    report,
    audit,
  };
}

module.exports = { runAudit, persistAudit };
