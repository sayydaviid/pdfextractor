// src/app/layout.js

import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

// Podemos usar o metadata novamente porque este não é mais um Client Component
export const metadata = {
  title: "Relatório PDF com Gemini",
  description: "Extraia dados de PDFs usando IA",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-br">
      <body className={inter.className}>
        {children}
        {/* Não há mais <AppProvider> ou <Script> aqui */}
      </body>
    </html>
  );
}