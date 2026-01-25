"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSmartNotifications, type SmartNotification } from "@/app/actions/advanced-ai-features";
import { Bell, AlertTriangle, Info, CheckCircle, AlertCircle, X, RefreshCw, ExternalLink, Zap } from "lucide-react";

export function SmartNotificationCenter() {
    const [notifications, setNotifications] = useState<SmartNotification[]>([]);
    const [loading, setLoading] = useState(true);
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());

    useEffect(() => {
        loadNotifications();
    }, []);

    async function loadNotifications() {
        setLoading(true);
        const result = await getSmartNotifications();
        if (result.success && result.notifications) {
            setNotifications(result.notifications);
        }
        setLoading(false);
    }

    const dismissNotification = (id: string) => {
        setDismissed(prev => new Set(prev).add(id));
    };

    const getTypeIcon = (type: SmartNotification['type']) => {
        switch (type) {
            case 'critical': return <AlertCircle className="w-5 h-5 text-red-500" />;
            case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
            case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
            case 'info': return <Info className="w-5 h-5 text-blue-500" />;
        }
    };

    const getTypeStyle = (type: SmartNotification['type']) => {
        switch (type) {
            case 'critical': return 'bg-red-50 border-red-200 hover:border-red-300';
            case 'warning': return 'bg-yellow-50 border-yellow-200 hover:border-yellow-300';
            case 'success': return 'bg-green-50 border-green-200 hover:border-green-300';
            case 'info': return 'bg-blue-50 border-blue-200 hover:border-blue-300';
        }
    };

    const getCategoryBadge = (category: SmartNotification['category']) => {
        const styles: Record<string, string> = {
            leave: 'bg-purple-100 text-purple-700',
            attendance: 'bg-blue-100 text-blue-700',
            policy: 'bg-gray-100 text-gray-700',
            team: 'bg-green-100 text-green-700',
            personal: 'bg-orange-100 text-orange-700'
        };
        return <Badge className={styles[category] || 'bg-gray-100 text-gray-700'}>{category}</Badge>;
    };

    const activeNotifications = notifications.filter(n => !dismissed.has(n.id));

    if (loading) {
        return (
            <Card className="animate-pulse">
                <CardHeader>
                    <div className="h-6 bg-gray-200 rounded w-1/3"></div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-20 bg-gray-100 rounded"></div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="shadow-lg border-0">
            <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-t-lg">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-lg relative">
                            <Bell className="w-6 h-6" />
                            {activeNotifications.filter(n => n.type === 'critical').length > 0 && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold">
                                    {activeNotifications.filter(n => n.type === 'critical').length}
                                </span>
                            )}
                        </div>
                        <div>
                            <CardTitle className="text-xl">Smart Notification Center</CardTitle>
                            <CardDescription className="text-white/80">
                                Context-aware, priority-based alerts
                            </CardDescription>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={loadNotifications} className="text-white hover:bg-white/20">
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-6">
                {activeNotifications.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle className="w-8 h-8 text-green-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">All Caught Up!</h3>
                        <p className="text-gray-500 mt-1">No pending notifications</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {/* Priority Summary */}
                        <div className="flex gap-2 mb-4">
                            <div className="flex items-center gap-1 px-3 py-1 bg-red-50 rounded-full border border-red-200">
                                <AlertCircle className="w-4 h-4 text-red-500" />
                                <span className="text-sm font-medium text-red-700">
                                    {activeNotifications.filter(n => n.type === 'critical').length} Critical
                                </span>
                            </div>
                            <div className="flex items-center gap-1 px-3 py-1 bg-yellow-50 rounded-full border border-yellow-200">
                                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                                <span className="text-sm font-medium text-yellow-700">
                                    {activeNotifications.filter(n => n.type === 'warning').length} Warning
                                </span>
                            </div>
                            <div className="flex items-center gap-1 px-3 py-1 bg-blue-50 rounded-full border border-blue-200">
                                <Info className="w-4 h-4 text-blue-500" />
                                <span className="text-sm font-medium text-blue-700">
                                    {activeNotifications.filter(n => n.type === 'info').length} Info
                                </span>
                            </div>
                        </div>

                        {/* Notifications List */}
                        {activeNotifications.map((notif) => (
                            <div 
                                key={notif.id}
                                className={`p-4 rounded-xl border transition-all duration-200 ${getTypeStyle(notif.type)}`}
                            >
                                <div className="flex items-start gap-4">
                                    <div className="mt-0.5">{getTypeIcon(notif.type)}</div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h5 className="font-semibold text-gray-900">{notif.title}</h5>
                                            {getCategoryBadge(notif.category)}
                                            <span className="text-xs text-gray-400 flex items-center gap-1">
                                                <Zap className="w-3 h-3" />
                                                Priority: {notif.priority}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-600">{notif.message}</p>
                                        
                                        {notif.actionUrl && (
                                            <div className="mt-3 flex gap-2">
                                                <Button 
                                                    size="sm" 
                                                    className={`${
                                                        notif.type === 'critical' ? 'bg-red-600 hover:bg-red-700' :
                                                        notif.type === 'warning' ? 'bg-yellow-600 hover:bg-yellow-700' :
                                                        'bg-blue-600 hover:bg-blue-700'
                                                    }`}
                                                    asChild
                                                >
                                                    <a href={notif.actionUrl}>
                                                        {notif.actionLabel || 'View'}
                                                        <ExternalLink className="w-3 h-3 ml-1" />
                                                    </a>
                                                </Button>
                                                <Button 
                                                    size="sm" 
                                                    variant="outline"
                                                    onClick={() => dismissNotification(notif.id)}
                                                >
                                                    Dismiss
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                    <button 
                                        onClick={() => dismissNotification(notif.id)}
                                        className="p-1 hover:bg-white rounded-full transition-colors"
                                    >
                                        <X className="w-4 h-4 text-gray-400" />
                                    </button>
                                </div>
                            </div>
                        ))}

                        {/* Dismissed Count */}
                        {dismissed.size > 0 && (
                            <div className="text-center pt-4 text-sm text-gray-500">
                                {dismissed.size} notification{dismissed.size > 1 ? 's' : ''} dismissed
                                <button 
                                    className="ml-2 text-indigo-600 hover:underline"
                                    onClick={() => setDismissed(new Set())}
                                >
                                    Show all
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
