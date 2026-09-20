import type { ReactNode } from "react";
import { Providers } from "./providers";
import { AppShell } from "@/shared/ui/AppShell/AppShell";
import "./globals.css";

type TRootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: TRootLayoutProps) {
  return (
    <html lang="ru">
      <head>
        <title>Vibely | Музыкальный</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
