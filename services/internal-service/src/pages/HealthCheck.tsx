import { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import type { HealthResponse } from '../types/services';
import { SERVICES } from '../types/services';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { CheckCircle2, XCircle, Activity, RefreshCw } from 'lucide-react';

interface ServiceHealth {
  name: string;
  port: number;
  health: HealthResponse | null;
  ready: HealthResponse | null;
  healthError: string | null;
  readyError: string | null;
  loading: boolean;
}

export const HealthCheck: React.FC = () => {
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [loading, setLoading] = useState(false);

  const checkHealth = async () => {
    setLoading(true);

    const serviceChecks: ServiceHealth[] = await Promise.all(
      Object.entries(SERVICES).map(async ([key, config]) => {
        const service: ServiceHealth = {
          name: config.name,
          port: config.port,
          health: null,
          ready: null,
          healthError: null,
          readyError: null,
          loading: true,
        };

        try {
          if (key === 'gateway') service.health = await apiService.gatewayHealth();
          else if (key === 'ask') service.health = await apiService.askHealth();
          else if (key === 'search') service.health = await apiService.searchHealth();
          else if (key === 'embed') service.health = await apiService.embedHealth();
          else if (key === 'queryOptimizer') service.health = await apiService.queryOptimizerHealth();
        } catch (err: unknown) {
          service.healthError = (err as { message?: string }).message || 'Failed to connect';
        }

        try {
          if (key === 'gateway') service.ready = await apiService.gatewayReady();
          else if (key === 'ask') service.ready = await apiService.askReady();
          else if (key === 'search') service.ready = await apiService.searchReady();
          else if (key === 'embed') service.ready = await apiService.embedReady();
          else if (key === 'queryOptimizer') service.ready = await apiService.queryOptimizerReady();
        } catch (err: unknown) {
          service.readyError = (err as { message?: string }).message || 'Failed to connect';
        }

        service.loading = false;
        return service;
      })
    );

    setServices(serviceChecks);
    setLoading(false);
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const getStatusIcon = (status: HealthResponse | null, error: string | null) => {
    if (error) return <XCircle className="w-4 h-4 text-rose-400" />;
    if (status) return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    return <Activity className="w-4 h-4 text-slate-500" />;
  };

  const getStatusText = (status: HealthResponse | null, error: string | null) => {
    if (error) return 'Error';
    if (status) return 'Healthy';
    return 'Unknown';
  };

  const getStatusColor = (status: HealthResponse | null, error: string | null) => {
    if (error) return 'bg-rose-500/5 border-rose-500/20';
    if (status) return 'bg-emerald-500/5 border-emerald-500/20';
    return 'bg-slate-800/40 border-slate-700/30';
  };

  const healthyCount = services.filter(s => s.health && !s.healthError).length;
  const readyCount = services.filter(s => s.ready && !s.readyError).length;
  const totalCount = services.length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex-shrink-0">
            <Activity className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100 tracking-tight">
              Health Check
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Monitor health and readiness of all microservices.
            </p>
          </div>
        </div>

        <button
          onClick={checkHealth}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg font-medium transition-all duration-200 text-xs border border-blue-500/20 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-900/50 border border-slate-700/30 rounded-xl p-4">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Total</div>
          <div className="text-2xl font-bold text-slate-200">{totalCount}</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-700/30 rounded-xl p-4">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Healthy</div>
          <div className="text-2xl font-bold text-emerald-400">{healthyCount}/{totalCount}</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-700/30 rounded-xl p-4">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Ready</div>
          <div className="text-2xl font-bold text-blue-400">{readyCount}/{totalCount}</div>
        </div>
      </div>

      {/* Service Cards */}
      {loading && services.length === 0 ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" text="Checking services..." />
        </div>
      ) : (
        <div className="space-y-3">
          {services.map((service) => (
            <div
              key={service.name}
              className="bg-slate-900/50 border border-slate-700/30 rounded-xl p-4 card-glow"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">{service.name}</h3>
                  <p className="text-[10px] text-slate-600 font-mono">:{service.port}</p>
                </div>
                {service.loading && <LoadingSpinner size="sm" />}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className={`p-3 rounded-xl border ${getStatusColor(service.health, service.healthError)}`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    {getStatusIcon(service.health, service.healthError)}
                    <span className="text-xs font-semibold text-slate-300">
                      {getStatusText(service.health, service.healthError)}
                    </span>
                  </div>
                  {service.healthError ? (
                    <p className="text-[10px] text-rose-400/70">{service.healthError}</p>
                  ) : service.health ? (
                    <div className="text-[10px] text-slate-500 space-y-0.5">
                      <div>v{service.health.version}</div>
                      <div>{new Date(service.health.timestamp).toLocaleTimeString()}</div>
                    </div>
                  ) : null}
                </div>

                <div className={`p-3 rounded-xl border ${getStatusColor(service.ready, service.readyError)}`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    {getStatusIcon(service.ready, service.readyError)}
                    <span className="text-xs font-semibold text-slate-300">
                      Ready: {getStatusText(service.ready, service.readyError)}
                    </span>
                  </div>
                  {service.readyError ? (
                    <p className="text-[10px] text-rose-400/70">{service.readyError}</p>
                  ) : service.ready ? (
                    <div className="text-[10px] text-slate-500 space-y-0.5">
                      <div>v{service.ready.version}</div>
                      <div>{new Date(service.ready.timestamp).toLocaleTimeString()}</div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
