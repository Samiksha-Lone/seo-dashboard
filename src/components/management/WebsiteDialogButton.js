"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import WebsiteForm from "@/components/management/WebsiteForm";
import ManagementModal from "@/components/management/ManagementModal";

const buttonStyles = {
  primary:
    "inline-flex w-fit items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700",
  secondary:
    "inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50",
  text: "text-sm font-semibold text-indigo-700 hover:text-indigo-900",
};

export default function WebsiteDialogButton({
  website = null,
  clients,
  initialClientId = "",
  label,
  variant = "primary",
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const title = website ? "Edit website" : "Add a website";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonStyles[variant] || buttonStyles.primary}
      >
        {label || title}
      </button>
      {open && (
        <ManagementModal title={title} onClose={close}>
          <WebsiteForm
            website={website}
            clients={clients}
            initialClientId={initialClientId}
            onCancel={close}
            onSaved={() => router.refresh()}
          />
        </ManagementModal>
      )}
    </>
  );
}
