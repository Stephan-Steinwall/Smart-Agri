// src/components/DashboardLayout.tsx
import Link from 'next/link';
import { Sprout, LayoutDashboard, Settings, Map, Bot } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-screen bg-background">
            {/* Sidebar */}
            <aside className="w-64 border-r border-border bg-card flex flex-col">
                <div className="h-16 flex items-center px-6 border-b border-border">
                    <Sprout className="w-6 h-6 text-primary mr-2" />
                    <span className="font-bold text-lg text-foreground">SmartAgri AI</span>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    <Link href="/" className="flex items-center px-4 py-3 rounded-lg bg-primary/10 text-primary font-medium">
                        <LayoutDashboard className="w-5 h-5 mr-3" />
                        Dashboard
                    </Link>
                    <Link href="/map" className="flex items-center px-4 py-3 rounded-lg text-muted-foreground hover:bg-muted transition-colors">
                        <Map className="w-5 h-5 mr-3" />
                        Field Map
                    </Link>
                    <Link href="/ai-assistant" className="flex items-center px-4 py-3 rounded-lg text-muted-foreground hover:bg-muted transition-colors">
                        <Bot className="w-5 h-5 mr-3" />
                        AI Assistant
                    </Link>
                    <Link href="/settings" className="flex items-center px-4 py-3 rounded-lg text-muted-foreground hover:bg-muted transition-colors">
                        <Settings className="w-5 h-5 mr-3" />
                        Device Config
                    </Link>
                </nav>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col overflow-hidden">
                <header className="h-16 border-b border-border bg-card flex items-center px-8 justify-between">
                    <h1 className="text-xl font-semibold text-foreground">Farm Overview</h1>
                    <div className="flex items-center space-x-4">
                        <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold">
                            F
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-auto p-8">
                    {children}
                </div>
            </main>
        </div>
    );
}