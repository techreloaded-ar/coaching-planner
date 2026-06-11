export default function FrontOfficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b px-6 py-3">
        <span className="font-semibold text-sm text-zinc-500 uppercase tracking-wider">
          Front Office — Area Collaboratore
        </span>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
