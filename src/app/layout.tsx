import type { Metadata } from "next";
import { Fredoka, Inter } from "next/font/google";

import { conversationService } from "@/server/conversations";
import { requireUser } from "@/server/current-user";

import { ConversationSidebar } from "./components/conversation-sidebar";
import { ToastProvider } from "./components/toast";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LiteChat",
  description: "Chat with ChatGPT, Claude and Gemini in one place",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const conversations = await conversationService().list(user);

  return (
    <html
      lang="en"
      className={`${inter.variable} ${fredoka.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ToastProvider>
          <div className="flex min-h-dvh">
            <ConversationSidebar initialConversations={conversations} />
            <div className="min-w-0 flex-1">{children}</div>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
