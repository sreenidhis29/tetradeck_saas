import DashboardLayout from '@/components/hr/DashboardLayout';

export default function DashboardPage() {
    return (
        <DashboardLayout>
            <div className="p-6">
                <h2 className="text-3xl font-bold text-white mb-6">HR Overview</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                        <h3 className="text-gray-400 mb-2">Total Employees</h3>
                        <p className="text-4xl font-bold text-white">1,240</p>
                    </div>
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                        <h3 className="text-gray-400 mb-2">Pending Leaves</h3>
                        <p className="text-4xl font-bold text-amber-500">42</p>
                    </div>
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                        <h3 className="text-gray-400 mb-2">Onboarding</h3>
                        <p className="text-4xl font-bold text-blue-500">18</p>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
