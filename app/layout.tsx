import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Research + Job Copilot",
  description:
    "Analyze resume-job fit, uncover skill gaps, and generate project and interview prep suggestions."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
