import { HRAdvancedDashboard } from "@/components/advanced/hr-advanced-dashboard";

export const metadata = {
    title: "Advanced AI Center | HR Dashboard",
    description: "AI-powered HR command center with conflict resolution, workload balancing, and team analytics"
};

export default function HRAdvancedPage() {
    return (
        <div className="container mx-auto p-6">
            <HRAdvancedDashboard />
        </div>
    );
}
