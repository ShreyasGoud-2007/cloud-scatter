import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { HardDrive, Activity, Database } from "lucide-react";

interface StorageNode {
  id: string;
  node_name: string;
  status: string;
  free_space_gb: number;
  total_space_gb: number;
  last_heartbeat: string;
}

export const NodeCluster = () => {
  const [nodes, setNodes] = useState<StorageNode[]>([]);

  useEffect(() => {
    fetchNodes();

    const channel = supabase
      .channel('storage-nodes-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'storage_nodes'
        },
        () => fetchNodes()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchNodes = async () => {
    const { data } = await supabase
      .from('storage_nodes')
      .select('*')
      .order('node_name');
    if (data) setNodes(data);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'hsl(var(--node-online))';
      case 'degraded':
        return 'hsl(var(--node-degraded))';
      case 'offline':
        return 'hsl(var(--node-offline))';
      default:
        return 'hsl(var(--muted))';
    }
  };

  const getUsagePercent = (node: StorageNode) => {
    return ((node.total_space_gb - node.free_space_gb) / node.total_space_gb) * 100;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {nodes.map((node) => (
        <Card 
          key={node.id} 
          className="relative p-6 bg-card border-border hover:border-primary/50 transition-all duration-300"
          style={{
            background: 'var(--gradient-card)',
            boxShadow: node.status === 'online' ? 'var(--glow-cyan)' : 'none'
          }}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <div 
                className="w-2 h-2 rounded-full animate-pulse" 
                style={{ backgroundColor: getStatusColor(node.status) }}
              />
              <h3 className="font-semibold text-foreground">{node.node_name}</h3>
            </div>
            <Badge 
              variant="outline" 
              className="text-xs"
              style={{ 
                borderColor: getStatusColor(node.status),
                color: getStatusColor(node.status)
              }}
            >
              {node.status}
            </Badge>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <HardDrive className="w-4 h-4" />
              <span>{node.free_space_gb}GB free</span>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Usage</span>
                <span>{getUsagePercent(node).toFixed(0)}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${getUsagePercent(node)}%` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Activity className="w-3 h-3" />
              <span>Last seen: {new Date(node.last_heartbeat).toLocaleTimeString()}</span>
            </div>
          </div>

          <div className="absolute -inset-px bg-gradient-to-r from-primary/20 to-secondary/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity -z-10" />
        </Card>
      ))}
    </div>
  );
};
