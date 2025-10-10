import { NodeCluster } from "@/components/NodeCluster";
import { FileUpload } from "@/components/FileUpload";
import { FileList } from "@/components/FileList";
import { Database, Network, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Database className="w-8 h-8 text-primary" />
                <div 
                  className="absolute -inset-1 bg-primary/20 rounded-full blur-md -z-10"
                  style={{ filter: 'blur(8px)' }}
                />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  Cloud-Connected Combined Storage System
                </h1>
                <p className="text-sm text-muted-foreground">
                  Distributed file storage across multiple nodes
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">{user.email}</span>
              <Button variant="outline" size="sm" onClick={signOut}>
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Storage Nodes Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Network className="w-6 h-6 text-secondary" />
            <h2 className="text-2xl font-bold text-foreground">Storage Cluster</h2>
          </div>
          <NodeCluster />
        </section>

        {/* Upload & Files Grid */}
        <div className="grid lg:grid-cols-2 gap-6">
          <FileUpload />
          <FileList />
        </div>

        {/* System Info */}
        <section className="mt-8 p-6 border border-border rounded-lg bg-card/50">
          <h3 className="text-lg font-semibold text-foreground mb-3">How It Works</h3>
          <div className="grid md:grid-cols-3 gap-4 text-sm text-muted-foreground">
            <div className="space-y-1">
              <p className="font-semibold text-primary">1. Upload</p>
              <p>Files are split into equal-sized chunks with SHA-256 checksums for integrity verification.</p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-secondary">2. Distribute</p>
              <p>Chunks are distributed across available online nodes in the storage cluster for redundancy.</p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-primary">3. Retrieve</p>
              <p>When requested, all chunks are fetched, verified, and reassembled into the original file.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Index;
