"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import ClientForm from "@/components/management/ClientForm";
import ManagementModal from "@/components/management/ManagementModal";

const buttonStyles = {
  primary:
    "inline-flex w-fit items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
  secondary:
    "inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
  text: "text-sm font-semibold text-indigo-700 hover:text-indigo-900 focus-visible:outline-none focus-visible:underline",
};

export default function ClientDialogButton({
  client = null,
  label,
  variant = "primary",
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const title = client ? "Edit client" : "Add a client";

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
          <ClientForm
            client={client}
            onCancel={close}
            onSaved={() => router.refresh()}
          />
        </ManagementModal>
      )}
    </>
  );
}
