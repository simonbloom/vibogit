export default function MiniLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="h-screen w-screen overflow-hidden bg-transparent flex items-center justify-center">
      {children}
    </main>
  );
}
