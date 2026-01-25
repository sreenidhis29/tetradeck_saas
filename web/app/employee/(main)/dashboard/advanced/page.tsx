import { EmployeeAdvancedDashboard } from "@/components/advanced/employee-advanced-dashboard";

export const metadata = {
    title: "Smart Leave Assistant | Employee Dashboard",
    description: "AI-powered tools to maximize your time off with holiday optimization and impact simulation"
};

export default function EmployeeAdvancedPage() {
    return (
        <div className="container mx-auto p-6">
            <EmployeeAdvancedDashboard />
        </div>
    );
}
