import { Sidebar } from "@/components/layout/Sidebar";
import { ReactNode } from "react";
import { PageTransition } from "./PageTransition";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="md:ml-64 p-4 md:p-8">
        <div className="mx-auto max-w-7xl">
          <PageTransition>
            {children}
          </PageTransition>
        </div>
      </main>
    </div>
  );
}
