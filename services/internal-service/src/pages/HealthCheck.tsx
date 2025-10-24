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

        // Check health endpoint
        try {
          if (key === 'gateway') service.health = await apiService.gatewayHealth();
          else if (key === 'ask') service.health = await apiService.askHealth();
          else if (key === 'search') service.health = await apiService.searchHealth();
          else if (key === 'embed') service.health = await apiService.embedHealth();
          else if (key === 'queryOptimizer') service.health = await apiService.queryOptimizerHealth();
        } catch (err: unknown) {
          service.healthError = (err as { message?: string }).message || 'Failed to connect';
        }

        // Check ready endpoint
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
    if (error) {
      return <XCircle className="w-5 h-5 text-red-600" />;
    }
    if (status) {
      return <CheckCircle2 className="w-5 h-5 text-green-600" />;
    }
    return <Activity className="w-5 h-5 text-gray-400" />;
  };

  const getStatusText = (status: HealthResponse | null, error: string | null) => {
    if (error) return 'Error';
    if (status) return 'Healthy';
    return 'Unknown';
  };

  const getStatusColor = (status: HealthResponse | null, error: string | null) => {
    if (error) return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
    if (status) return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
    return 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700';
  };

  const healthyCount = services.filter(s => s.health && !s.healthError).length;
  const readyCount = services.filter(s => s.ready && !s.readyError).length;
  const totalCount = services.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Health Check Dashboard
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Monitor the health and readiness status of all microservices
          </p>
        </div>

        <button
          onClick={checkHealth}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Services</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">{totalCount}</div>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Healthy</div>
          <div className="text-3xl font-bold text-green-600">
            {healthyCount}/{totalCount}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Ready</div>
          <div className="text-3xl font-bold text-blue-600">
            {readyCount}/{totalCount}
          </div>
        </div>
      </div>

      {/* Service Status Cards */}
      {loading && services.length === 0 ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" text="Checking services..." />
        </div>
      ) : (
        <div className="space-y-4">
          {services.map((service) => (
            <div
              key={service.name}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {service.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Port: {service.port}
                  </p>
                </div>
                {service.loading && <LoadingSpinner size="sm" />}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Health Status */}
                <div className={`p-4 rounded-lg border ${getStatusColor(service.health, service.healthError)}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusIcon(service.health, service.healthError)}
                    <span className="font-semibold text-gray-900 dark:text-white">
                      Health: {getStatusText(service.health, service.healthError)}
                    </span>
                  </div>
                  {service.healthError ? (
                    <p className="text-sm text-red-600 dark:text-red-400">{service.healthError}</p>
                  ) : service.health ? (
                    <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      <div>Status: {service.health.status}</div>
                      <div>Version: {service.health.version}</div>
                      <div>Timestamp: {new Date(service.health.timestamp).toLocaleString()}</div>
                    </div>
                  ) : null}
                </div>

                {/* Ready Status */}
                <div className={`p-4 rounded-lg border ${getStatusColor(service.ready, service.readyError)}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusIcon(service.ready, service.readyError)}
                    <span className="font-semibold text-gray-900 dark:text-white">
                      Ready: {getStatusText(service.ready, service.readyError)}
                    </span>
                  </div>
                  {service.readyError ? (
                    <p className="text-sm text-red-600 dark:text-red-400">{service.readyError}</p>
                  ) : service.ready ? (
                    <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      <div>Status: {service.ready.status}</div>
                      <div>Version: {service.ready.version}</div>
                      <div>Timestamp: {new Date(service.ready.timestamp).toLocaleString()}</div>
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
