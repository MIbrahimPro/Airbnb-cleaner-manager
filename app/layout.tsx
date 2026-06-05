import "./globals.css";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <title>Cleaner Quality Control</title>
        <meta name="description" content="AI-powered cleaner inspection submission form." />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#f2f2f7" />
      </head>
      <body>{children}</body>
    </html>
  );
}
