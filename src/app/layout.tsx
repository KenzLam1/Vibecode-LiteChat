import type { Metadata } from "next";
import { Fredoka, Inter } from "next/font/google";

import { conversationService } from "@/server/conversations";
import { currentUser } from "@/server/current-user";

import { ConversationSidebar } from "./components/conversation-sidebar";
import { LogoutControl } from "./components/logout-control";
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
  const user = await currentUser();
  const conversations = user ? await conversationService().list(user) : [];

  return (
    <html
      lang="en"
      className={`${inter.variable} ${fredoka.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ToastProvider>
          {user ? (
            <div className="flex min-h-dvh">
              <ConversationSidebar
                initialConversations={conversations}
                accountControl={<LogoutControl />}
              />
              <div className="min-w-0 flex-1">{children}</div>
            </div>
          ) : (
            children
          )}
        </ToastProvider>
      </body>
    </html>
  );
}
