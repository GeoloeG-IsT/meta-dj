export const metadata = { title: 'Meta DJ', description: 'Local-first DJ library manager' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}


