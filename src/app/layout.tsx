import { ConnectButton } from "@/components/ConnectButton";
import { QueryClientProvider } from "@/components/providers/QueryClientProvider";
import { ThemedPrivyProvider } from "@/components/providers/ThemedPrivyProvider";
import { ModeToggle } from "@/components/ui/ModeToggle";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";
import Dynamic from "@/components/utils/Dynamic";
import { cn } from "@/lib/cn";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Negation Game",
  description: "Learning through dissent",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <body
        className={cn(inter.className, "h-full flex flex-col overflow-clip")}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ThemedPrivyProvider>
            <QueryClientProvider>
              <TooltipProvider>
                <header className="sticky top-0 z-10 border-b py-sm flex justify-between container-padding items-center w-full bg-background h-2xl">
                  <p className={cn("font-bold")}>Negation Game</p>
                  {/* <Navigation className="hidden sm:block" /> */}
                  <div className="flex gap-sm">
                    <Dynamic>
                      <ModeToggle className="col-start-3 justify-self-end" />
                    </Dynamic>
                    <ConnectButton />
                  </div>
                </header>

                {children}

                <Toaster />
                {/* <footer className="sm:hidden sticky bottom-0 border-t border-border bg-background h-2xl content-center">
                  <Navigation className="sm:hidden" />
                </footer> */}
              </TooltipProvider>
            </QueryClientProvider>
          </ThemedPrivyProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}