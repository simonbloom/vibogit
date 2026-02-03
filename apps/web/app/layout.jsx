export const metadata = {
  title: "ViboGit",
  description: "Git for the Vibe Coder",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
