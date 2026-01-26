"use client";

import { useState, useEffect } from "react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Eye, CheckCircle, XCircle, Clock } from "lucide-react";

export default function AdminStrategiesPage() {
  const [strategies, setStrategies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStrategy, setSelectedStrategy] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);

  useEffect(() => {
    fetchStrategies();
  }, []);

    const fetchStrategies = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/strategies");
        const data = await res.json();
        setStrategies(data.strategies || []);
      } catch {
        toast.error("Failed to fetch strategies");
      } finally {
        setLoading(false);
      }
    };

    const handleApprove = async (strategyId: number) => {
      try {
        const res = await fetch("/api/admin/strategies/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ strategyId, approved: true }),
        });
        
        if (res.ok) {
          toast.success("Strategy approved successfully");
          fetchStrategies();
        } else {
          throw new Error();
        }
      } catch {
        toast.error("Failed to approve strategy");
      }
    };

    const handleReject = async () => {
      if (!rejectionReason) {
        toast.error("Please provide a reason for rejection");
        return;
      }

      try {
        const res = await fetch("/api/admin/strategies/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            strategyId: selectedStrategy.id, 
            approved: false, 
            reason: rejectionReason 
          }),
        });
        
        if (res.ok) {
          toast.success("Strategy rejected");
          setIsRejecting(false);
          setRejectionReason("");
          fetchStrategies();
        } else {
          throw new Error();
        }
      } catch {
        toast.error("Failed to reject strategy");
      }
    };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Strategy Management</h1>
          <p className="text-muted-foreground">Review and approve public/invite-only strategies</p>
        </div>
        <Button onClick={fetchStrategies} variant="outline">Refresh</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Approvals</CardTitle>
          <CardDescription>Strategies waiting for administrative review</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8">Loading...</div>
          ) : strategies.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">No pending strategies found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Visibility</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {strategies.map((strategy) => (
                  <TableRow key={strategy.id}>
                    <TableCell className="font-medium">{strategy.name}</TableCell>
                    <TableCell>{strategy.profiles?.username || strategy.user_id}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{strategy.visibility}</Badge>
                    </TableCell>
                    <TableCell>
                      {strategy.admin_approved === true ? (
                        <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> Approved</Badge>
                      ) : strategy.admin_approved === false ? (
                        <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Rejected</Badge>
                      ) : (
                        <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell>{new Date(strategy.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => setSelectedStrategy(strategy)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>{strategy.name}</DialogTitle>
                            <DialogDescription>{strategy.description}</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="p-3 border rounded bg-muted/30">
                                <h4 className="font-semibold mb-2">Buy Entry Logic</h4>
                                <ul className="text-xs list-disc pl-4">
                                  {strategy.buy_entry_logic?.conditions?.map((c: string, i: number) => (
                                    <li key={i}>{c}</li>
                                  ))}
                                </ul>
                              </div>
                              <div className="p-3 border rounded bg-muted/30">
                                <h4 className="font-semibold mb-2">Sell Entry Logic</h4>
                                <ul className="text-xs list-disc pl-4">
                                  {strategy.sell_entry_logic?.conditions?.map((c: string, i: number) => (
                                    <li key={i}>{c}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                            <div className="p-3 border rounded bg-muted/30">
                              <h4 className="font-semibold mb-2">Risk Management</h4>
                              <p className="text-xs">Stop Loss: {strategy.buy_stop_loss?.parameters?.percentage}%</p>
                              <p className="text-xs">Target: {strategy.buy_target?.parameters?.percentage}%</p>
                            </div>
                          </div>
                          <DialogFooter>
                            {strategy.admin_approved === null && (
                              <>
                                <Button 
                                  variant="destructive" 
                                  onClick={() => {
                                    setSelectedStrategy(strategy);
                                    setIsRejecting(true);
                                  }}
                                >
                                  Reject
                                </Button>
                                <Button onClick={() => handleApprove(strategy.id)}>Approve</Button>
                              </>
                            )}
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isRejecting} onOpenChange={setIsRejecting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Strategy</DialogTitle>
            <DialogDescription>Please provide a reason for rejecting this strategy.</DialogDescription>
          </DialogHeader>
          <Textarea 
            placeholder="Reason for rejection..." 
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsRejecting(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject}>Reject Strategy</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
