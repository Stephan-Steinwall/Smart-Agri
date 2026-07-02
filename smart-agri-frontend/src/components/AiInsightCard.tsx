"use client";

import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BrainCircuit, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

export default function AiInsightCard({ fieldId, fieldName }: { fieldId: string, fieldName: string }) {
    const { data: insight, isLoading, isError } = useQuery({
        queryKey: ['ai-insight', fieldId],
        queryFn: async () => {
            const res = await axios.get(`http://localhost:3001/api/v1/ai/insight/${fieldId}`);
            return res.data;
        },
        refetchInterval: 300000 // Only ask AI every 5 minutes to save API costs
    });

    if (isLoading) {
        return (
            <Card className="animate-pulse border-primary/20">
                <CardHeader><CardTitle className="text-muted-foreground text-sm">Analyzing {fieldName}...</CardTitle></CardHeader>
                <CardContent className="h-32 flex items-center justify-center">
                    <BrainCircuit className="w-8 h-8 text-primary animate-bounce" />
                </CardContent>
            </Card>
        );
    }

    if (isError || insight?.error) {
        return (
            <Card className="border-destructive/50">
                <CardHeader><CardTitle className="text-sm">{fieldName}</CardTitle></CardHeader>
                <CardContent><p className="text-xs text-muted-foreground">Unable to generate AI insight.</p></CardContent>
            </Card>
        );
    }

    // Determine colors based on Risk Level
    const isHighRisk = insight.riskLevel === 'High';
    const isMediumRisk = insight.riskLevel === 'Medium';

    return (
        <Card className={`border-l-4 ${isHighRisk ? 'border-l-destructive' : isMediumRisk ? 'border-l-orange-500' : 'border-l-green-500'} shadow-sm`}>
            <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                    <CardTitle className="text-lg font-bold">{fieldName}</CardTitle>
                    <Badge variant={isHighRisk ? 'destructive' : isMediumRisk ? 'outline' : 'default'}
                        className={isMediumRisk ? 'text-orange-600 border-orange-500' : ''}>
                        {insight.riskLevel} Risk
                    </Badge>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Health Score */}
                <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Soil Health</span>
                        <span className="font-bold">{insight.healthScore}% - {insight.status}</span>
                    </div>
                    <Progress value={insight.healthScore} className={`h-2 ${isHighRisk ? 'bg-destructive/20' : ''}`} />
                </div>

                {/* AI Action Command */}
                <div className="bg-muted/50 p-3 rounded-lg border border-border">
                    <div className="flex items-center space-x-2 font-semibold text-foreground mb-1">
                        {isHighRisk ? <AlertTriangle className="w-4 h-4 text-destructive" /> : <CheckCircle2 className="w-4 h-4 text-green-500" />}
                        <span>Action: {insight.primaryAction}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        {insight.detailedReason}
                    </p>
                </div>
            </CardContent>

            <CardFooter className="pt-0 border-t border-border mt-4">
                <div className="flex items-center text-[10px] text-muted-foreground mt-3 uppercase tracking-wider">
                    <BrainCircuit className="w-3 h-3 mr-1" />
                    AI Generated Insight
                </div>
            </CardFooter>
        </Card>
    );
}