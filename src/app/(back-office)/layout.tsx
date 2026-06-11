export default function BackOfficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b px-6 py-3 bg-zinc-900 text-white">
        <span className="font-semibold text-sm uppercase tracking-wider">
          Back Office — Area Amministratore
        </span>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
