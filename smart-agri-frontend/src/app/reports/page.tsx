"use client";

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Table as TableIcon, Download, Loader2, ChevronDown } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const API_BASE = 'http://localhost:3001/api/v1';

interface Field {
    id: string;
    name: string;
}

interface SensorNode {
    id: string;
    field: Field | null;
}

export default function ReportsDashboard() {
    const [selectedField, setSelectedField] = useState<Field | null>(null);

    // --- Step 1: Dynamically fetch all fields via sensor-nodes ---
    const { data: sensorNodes, isLoading: isLoadingFields } = useQuery<SensorNode[]>({
        queryKey: ['sensor-nodes'],
        queryFn: async () => {
            const res = await axios.get(`${API_BASE}/devices/sensor-nodes`);
            return res.data;
        },
        staleTime: 60_000,
    });

    // Deduplicate to get unique fields
    const fields: Field[] = sensorNodes
        ? Array.from(
            new Map(
                sensorNodes
                    .filter((n) => n.field !== null)
                    .map((n) => [n.field!.id, n.field!])
            ).values()
        )
        : [];

    // Auto-select the first field once loaded
    if (fields.length > 0 && selectedField === null) {
        setSelectedField(fields[0]);
    }

    // --- Step 2: Fetch automation logs for the selected field ---
    const { data: devices, isLoading: isLoadingLogs } = useQuery({
        queryKey: ['automationLogs', selectedField?.id],
        queryFn: async () => {
            const res = await axios.get(`${API_BASE}/automation/field/${selectedField!.id}`);
            return res.data;
        },
        enabled: !!selectedField, // Only run when a field is selected
    });

    // Extract all logs into a flat array for the reports
    const allLogs = devices?.flatMap((d: any) =>
        d.logs.map((log: any) => ({
            Device: d.name,
            Action: log.action ? 'Turned ON' : 'Turned OFF',
            Trigger: log.triggeredBy,
            Time: new Date(log.timestamp).toLocaleString(),
        }))
    ).sort((a: any, b: any) => new Date(b.Time).getTime() - new Date(a.Time).getTime()) || [];

    // --- PDF GENERATOR ---
    const generatePDF = () => {
        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.text('SmartAgri Automation Report', 14, 22);
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
        doc.text(`Field Analyzed: ${selectedField?.name ?? 'Unknown'}`, 14, 36);

        autoTable(doc, {
            startY: 45,
            head: [['Device Name', 'Action Taken', 'Trigger Source', 'Timestamp']],
            body: allLogs.map((log: any) => [log.Device, log.Action, log.Trigger, log.Time]),
            theme: 'grid',
            headStyles: { fillColor: [34, 197, 94] },
        });

        doc.save(`SmartAgri_${selectedField?.name ?? 'Report'}.pdf`);
    };

    // --- EXCEL GENERATOR ---
    const generateExcel = () => {
        const worksheet = XLSX.utils.json_to_sheet(allLogs);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Automation Logs');
        XLSX.writeFile(workbook, `SmartAgri_${selectedField?.name ?? 'Report'}.xlsx`);
    };

    return (
        <div className="space-y-6 max-w-4xl">
            <div>
                <h2 className="text-2xl font-bold tracking-tight flex items-center">
                    <Download className="w-6 h-6 mr-2 text-primary" />
                    Data Export &amp; Reports
                </h2>
                <p className="text-muted-foreground">Download regulatory and analytical reports for your farm.</p>
            </div>

            {/* Field Selector */}
            <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground">Reporting for:</span>
                {isLoadingFields ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading fields…
                    </div>
                ) : (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="gap-2">
                                {selectedField?.name ?? 'Select a field'}
                                <ChevronDown className="w-4 h-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            {fields.map((field) => (
                                <DropdownMenuItem
                                    key={field.id}
                                    onSelect={() => setSelectedField(field)}
                                    className={selectedField?.id === field.id ? 'bg-muted font-semibold' : ''}
                                >
                                    {field.name}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
                {isLoadingLogs && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* PDF Card */}
                <Card className="border-2 hover:border-primary/50 transition-colors">
                    <CardHeader>
                        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-lg flex items-center justify-center mb-4">
                            <FileText className="w-6 h-6" />
                        </div>
                        <CardTitle>Activity PDF Report</CardTitle>
                        <CardDescription>A formatted, print-ready document containing pump actions, AI interventions, and timestamps.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button
                            onClick={generatePDF}
                            disabled={!selectedField || isLoadingLogs}
                            className="w-full bg-red-600 hover:bg-red-700 text-white"
                        >
                            Download PDF
                        </Button>
                    </CardContent>
                </Card>

                {/* Excel Card */}
                <Card className="border-2 hover:border-primary/50 transition-colors">
                    <CardHeader>
                        <div className="w-12 h-12 bg-green-100 text-green-600 rounded-lg flex items-center justify-center mb-4">
                            <TableIcon className="w-6 h-6" />
                        </div>
                        <CardTitle>Raw Data Spreadsheet</CardTitle>
                        <CardDescription>A raw Excel spreadsheet (.xlsx) perfect for running your own pivot tables and deep analysis.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button
                            onClick={generateExcel}
                            disabled={!selectedField || isLoadingLogs}
                            className="w-full bg-green-600 hover:bg-green-700 text-white"
                        >
                            Download Excel
                        </Button>
                    </CardContent>
                </Card>

            </div>
        </div>
    );
}