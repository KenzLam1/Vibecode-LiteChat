import Link from "next/link";
import type { ReactNode } from "react";

// LiteChat's centred card, shared by the login and sign-up pages.
export function AuthCard({
  subtitle,
  children,
  footer,
  footerLink,
  footerHref,
}: {
  subtitle: string;
  children: ReactNode;
  footer: string;
  footerLink: string;
  footerHref: string;
}) {
  return (
    <main className="m-auto w-full max-w-sm p-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-center font-display text-3xl font-semibold text-primary">
          LiteChat
        </h1>
        <p className="mt-1 mb-6 text-center text-gray-600">{subtitle}</p>
        {children}
      </div>
      <p className="mt-4 text-center text-sm text-gray-600">
        {footer}{" "}
        <Link href={footerHref} className="font-medium text-primary hover:underline">
          {footerLink}
        </Link>
      </p>
    </main>
  );
}
