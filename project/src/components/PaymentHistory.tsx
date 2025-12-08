import React, { useState } from 'react';
import { useStore } from '../lib/store';
import { Tenant } from '../lib/types';
import { ChevronDown, ChevronUp } from 'lucide-react';

type TenantPaymentSummary = {
  tenant: Tenant;
  totalRentDue: number;
  totalPaid: number;
  balance: number;
  lastPaymentDate: string | null;
  paymentStatus: 'Paid' | 'Partial' | 'Unpaid';
};

const PaymentHistory: React.FC = () => {
  const { payments, tenants, fetchPayments, fetchTenants, loading } = useStore();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [expandedTenants, setExpandedTenants] = useState<Record<string, boolean>>({});

  React.useEffect(() => {
    fetchPayments();
    fetchTenants();
  }, [fetchPayments, fetchTenants]);

  // Toggle expanded state for a tenant
  const toggleExpand = (tenantId: string) => {
    setExpandedTenants(prev => ({
      ...prev,
      [tenantId]: !prev[tenantId]
    }));
  };

  // Calculate payment summaries for each tenant
  const paymentSummaries = React.useMemo(() => {
    const summaries: TenantPaymentSummary[] = [];

    tenants.forEach((tenant) => {
      const tenantPayments = payments.filter(
        (payment) => payment.tenant_id === tenant.id
      );

      const currentDate = new Date();
      const leaseStartDate = new Date(tenant.lease_start);
      const monthsActive = Math.max(
        0,
        (currentDate.getFullYear() - leaseStartDate.getFullYear()) * 12 +
          (currentDate.getMonth() - leaseStartDate.getMonth())
      );

      const totalRentDue = tenant.rent_amount * monthsActive;
      const totalPaid = tenantPayments.reduce(
        (sum, payment) => {
          // Only count payments that have been made (have a payment date)
          if (!payment.payment_date) return sum;
          return sum + payment.amount;
        },
        0
      );
      const balance = totalRentDue - totalPaid;

      const lastPayment = tenantPayments
        .filter((p) => p.payment_date)
        .sort(
          (a, b) =>
            new Date(b.payment_date!).getTime() -
            new Date(a.payment_date!).getTime()
        )[0];

      let paymentStatus: 'Paid' | 'Partial' | 'Unpaid';
      if (balance <= 0) {
        paymentStatus = 'Paid';
      } else if (totalPaid > 0) {
        paymentStatus = 'Partial';
      } else {
        paymentStatus = 'Unpaid';
      }

      summaries.push({
        tenant,
        totalRentDue,
        totalPaid,
        balance,
        lastPaymentDate: lastPayment?.payment_date || null,
        paymentStatus,
      });
    });

    return summaries;
  }, [payments, tenants]);

  // Filter summaries based on search and status
  const filteredSummaries = paymentSummaries.filter((summary) => {
    const matchesSearch =
      !searchQuery ||
      summary.tenant.tenant_name
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      summary.tenant.unit?.unit_number
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      summary.paymentStatus.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  // Generate monthly payment data for a tenant
  const generateMonthlyBreakdown = (tenantId: string) => {
    const tenant = tenants.find(t => t.id === tenantId);
    if (!tenant) return [];
    
    const tenantPayments = payments.filter(p => p.tenant_id === tenantId);
    const leaseStartDate = new Date(tenant.lease_start);
    const currentDate = new Date();
    
    // Create an array of months from lease start to current date
    const months = [];
    let date = new Date(leaseStartDate);
    
    while (date <= currentDate) {
      const year = date.getFullYear();
      const month = date.getMonth();
      
      // Find payments allocated to this month based on due date
      const monthPayments = tenantPayments.filter(payment => {
        if (!payment.payment_date) return false;
        
        // Use due_date to determine which month the payment is for
        // This ensures payments for previous months are allocated correctly
        const [pYear, pMonth] = payment.due_date.split('-').map(Number);
        return pYear === year && (pMonth - 1) === month;
      });
      
      // Calculate total paid this month
      const totalPaid = monthPayments.reduce((sum, payment) => sum + payment.amount, 0);
      
      months.push({
        monthYear: `${date.toLocaleString('default', { month: 'long' })} ${year}`,
        expected: tenant.rent_amount,
        paid: totalPaid,
        balance: tenant.rent_amount - totalPaid,
        status: totalPaid >= tenant.rent_amount ? 'Paid' : totalPaid > 0 ? 'Partial' : 'Unpaid',
        payments: monthPayments
      });
      
      // Move to next month
      date.setMonth(date.getMonth() + 1);
    }
    
    return months.reverse(); // Most recent first
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
        return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300';
      case 'partial':
        return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300';
      case 'unpaid':
        return 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300';
    }
  };

  return (
    <div className="space-y-4 h-screen payment-history-container" key="payment-history-component">
      <div className="flex flex-col sm:flex-row gap-4 p-4 sm:p-6">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by tenant name or unit..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-indigo-500 focus:border-indigo-500 dark:focus:border-indigo-500"
          />
        </div>
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-indigo-500 focus:border-indigo-500 dark:focus:border-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="unpaid">Unpaid</option>
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Payment History
          </h2>
        </div>
        
        {loading ? (
          <div className="p-8 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Loading payment information...
            </p>
          </div>
        ) : filteredSummaries.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No payment records found matching your criteria.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredSummaries.map((summary) => (
              <div key={summary.tenant.id} className="transition-colors duration-150">
                <div className="p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                        Room {summary.tenant.unit?.unit_number}
                      </h3>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {summary.tenant.tenant_name}
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                        summary.paymentStatus
                      )}`}
                    >
                      {summary.paymentStatus}
                    </span>
                  </div>
                  
                  <div className="flex flex-row gap-3 mb-3">
                    <div className="w-1/2 p-3 rounded-lg bg-gray-100 dark:bg-gray-700/50">
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Monthly Rent
                      </div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        KES {summary.tenant.rent_amount.toLocaleString()}
                      </div>
                    </div>
                    
                    <div className="w-1/2 p-3 rounded-lg bg-gray-100 dark:bg-gray-700/50">
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Balance
                      </div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        KES {summary.balance.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-row gap-3 mb-3">
                    <div className="w-1/2 p-3 rounded-lg bg-gray-100 dark:bg-gray-700/50">
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Total Due
                      </div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        KES {summary.totalRentDue.toLocaleString()}
                      </div>
                    </div>
                    
                    <div className="w-1/2 p-3 rounded-lg bg-gray-100 dark:bg-gray-700/50">
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Total Paid
                      </div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        KES {summary.totalPaid.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-700/50 mb-3">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Last Payment
                    </div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {summary.lastPaymentDate
                        ? new Date(summary.lastPaymentDate).toLocaleDateString()
                        : 'No payment recorded'}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => toggleExpand(summary.tenant.id)}
                    className="w-full flex items-center justify-center p-2 text-sm bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50 rounded-md"
                  >
                    {expandedTenants[summary.tenant.id] ? (
                      <>
                        <span>Hide Monthly Breakdown</span>
                        <ChevronUp className="ml-2 h-4 w-4" />
                      </>
                    ) : (
                      <>
                        <span>Show Monthly Breakdown</span>
                        <ChevronDown className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </button>
                  
                  {expandedTenants[summary.tenant.id] && (
                    <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Monthly Payment Breakdown
                      </h4>
                      
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                        {summary.tenant.tenant_name} - Room {summary.tenant.unit?.unit_number}
                      </div>
                      
                      <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                        {generateMonthlyBreakdown(summary.tenant.id).map((month, idx) => (
                          <div 
                            key={idx} 
                            className="rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm"
                          >
                            <div className="px-4 py-3 flex justify-between items-center bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                              <div className="text-base font-bold text-gray-900 dark:text-white">
                                {month.monthYear}
                              </div>
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  month.status === 'Paid' 
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                                    : month.status === 'Partial' 
                                      ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400'
                                      : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
                                }`}
                              >
                                {month.status}
                              </span>
                            </div>
                            
                            <div className="px-4 py-3 text-gray-700 dark:text-gray-300">
                              <div className="text-sm mb-2">
                                Expected: KSh {month.expected.toLocaleString()}
                              </div>
                              
                              {month.payments.length > 0 ? (
                                <>
                                  <div className="text-sm font-medium mb-2">Payments</div>
                                  <div className="space-y-2">
                                    {month.payments.map((payment, paymentIdx) => (
                                      <div 
                                        key={paymentIdx} 
                                        className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3"
                                      >
                                        <div className="flex justify-between items-center">
                                          <div>
                                            <div className="text-sm font-bold text-gray-900 dark:text-white">
                                              KSh {payment.amount.toLocaleString()}
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                              {new Date(payment.payment_date || '').toLocaleDateString()}
                                            </div>
                                          </div>
                                          <div className="bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded text-xs">
                                            {payment.payment_method || 'Cash'}
                                          </div>
                                        </div>
                                        
                                        {payment.payment_method === 'Mpesa' && payment.mpesa_code && (
                                          <div className="mt-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 p-2 rounded-lg text-xs">
                                            Mpesa Code: {payment.mpesa_code}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </>
                              ) : (
                                <div className="text-xs text-gray-500 dark:text-gray-400 italic mb-2">No payments recorded</div>
                              )}
                              
                              <div className="grid grid-cols-2 gap-3 mt-3">
                                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Total Paid</div>
                                  <div className="text-sm font-bold text-gray-900 dark:text-white">
                                    KSh {month.paid.toLocaleString()}
                                  </div>
                                </div>
                                
                                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Balance</div>
                                  <div className={`text-sm font-bold ${
                                    month.balance <= 0 
                                      ? 'text-green-600 dark:text-green-400' 
                                      : 'text-red-600 dark:text-red-400'
                                  }`}>
                                    KSh {month.balance.toLocaleString()} {month.balance > 0 ? '(Due)' : ''}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentHistory;
