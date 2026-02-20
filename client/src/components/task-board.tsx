import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type Task } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, CheckSquare, Plus, Trash2, AlertTriangle, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function TaskBoard({ farmId }: { farmId: number }) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isAdding, setIsAdding] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState("");
    const [newTaskDesc, setNewTaskDesc] = useState("");

    const { data: tasks = [], isLoading } = useQuery<Task[]>({
        queryKey: ["/api/farms", farmId, "tasks"],
        queryFn: async () => {
            const res = await fetch(`/api/farms/${farmId}/tasks`);
            if (!res.ok) throw new Error("Falha ao buscar tarefas");
            return res.json();
        }
    });

    const updateTask = useMutation({
        mutationFn: async ({ id, status }: { id: number; status: string }) => {
            const res = await apiRequest("PATCH", `/api/tasks/${id}`, { status });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farms", farmId, "tasks"] });
            toast({ title: "Tarefa atualizada com sucesso!" });
        }
    });

    const addTask = useMutation({
        mutationFn: async (taskData: any) => {
            const res = await apiRequest("POST", `/api/farms/${farmId}/tasks`, taskData);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farms", farmId, "tasks"] });
            setIsAdding(false);
            setNewTaskTitle("");
            setNewTaskDesc("");
            toast({ title: "Nova tarefa criada!" });
        }
    });

    const deleteTask = useMutation({
        mutationFn: async (id: number) => {
            await apiRequest("DELETE", `/api/tasks/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farms", farmId, "tasks"] });
            toast({ title: "Tarefa removida.", variant: "destructive" });
        }
    });

    if (isLoading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Carregando quadro de atividades...</div>;

    const pending = tasks.filter(t => t.status === "pending" || t.status === "in_progress");
    const completed = tasks.filter(t => t.status === "completed");

    const getPriorityBadge = (p: string) => {
        switch (p) {
            case 'critical': return <Badge variant="destructive" className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Crítico</Badge>;
            case 'high': return <Badge className="bg-orange-500 hover:bg-orange-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Alta</Badge>;
            case 'medium': return <Badge variant="secondary">Média</Badge>;
            case 'low': return <Badge variant="outline">Baixa</Badge>;
            default: return null;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Vistorias e Ações</h2>
                    <p className="text-muted-foreground">Plano de ação focado em anomalias detectadas e atividades diárias.</p>
                </div>
                <Button onClick={() => setIsAdding(!isAdding)} className="bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="w-4 h-4 mr-2" /> Agendar Tarefa
                </Button>
            </div>

            {isAdding && (
                <Card className="border-emerald-200 bg-emerald-50/30">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Nova Atividade Manual</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Input
                            placeholder="Título (ex: Calibrar Bicos do Pulverizador)"
                            value={newTaskTitle}
                            onChange={e => setNewTaskTitle(e.target.value)}
                        />
                        <Textarea
                            placeholder="Descreva a atividade a ser feita no campo..."
                            value={newTaskDesc}
                            onChange={e => setNewTaskDesc(e.target.value)}
                        />
                        <div className="flex justify-end gap-2">
                            <Button variant="ghost" onClick={() => setIsAdding(false)}>Cancelar</Button>
                            <Button
                                onClick={() => addTask.mutate({ title: newTaskTitle, description: newTaskDesc, priority: "medium", status: "pending" })}
                                disabled={!newTaskTitle || addTask.isPending}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                Salvar Tarefa
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid md:grid-cols-2 gap-6">
                {/* A Fazer / Em Progresso */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                        <Clock className="w-5 h-5 text-amber-500" />
                        <h3 className="font-semibold text-lg">Pendente / Em Execução ({pending.length})</h3>
                    </div>

                    {pending.length === 0 ? (
                        <div className="text-center p-8 border border-dashed rounded-lg text-muted-foreground bg-muted/20">
                            Nenhuma ação pendente no momento. Tudo verde! 🌿
                        </div>
                    ) : (
                        pending.map(task => (
                            <Card key={task.id} className={`transition-all hover:shadow-md ${task.status === 'in_progress' ? 'border-amber-200 bg-amber-50/10' : ''}`}>
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start gap-4">
                                        <CardTitle className="text-base leading-tight">{task.title}</CardTitle>
                                        {getPriorityBadge(task.priority)}
                                    </div>
                                    {task.dueDate && (
                                        <CardDescription className="text-xs">
                                            Sugerido para: {format(new Date(task.dueDate), "dd 'de' MMMM", { locale: ptBR })}
                                        </CardDescription>
                                    )}
                                </CardHeader>
                                <CardContent className="pb-2">
                                    <p className="text-sm text-foreground/80 whitespace-pre-line">{task.description}</p>
                                </CardContent>
                                <CardFooter className="pt-2 flex justify-between">
                                    <div className="flex gap-2">
                                        {task.status === "pending" && (
                                            <Button variant="outline" size="sm" onClick={() => updateTask.mutate({ id: task.id, status: "in_progress" })}>
                                                Iniciar
                                            </Button>
                                        )}
                                        <Button
                                            size="sm"
                                            onClick={() => updateTask.mutate({ id: task.id, status: "completed" })}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                        >
                                            <CheckCircle2 className="w-4 h-4 mr-2" /> Concluir
                                        </Button>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => deleteTask.mutate(task.id)} className="text-muted-foreground hover:text-red-500">
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))
                    )}
                </div>

                {/* Concluídas */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                        <CheckSquare className="w-5 h-5 text-emerald-600" />
                        <h3 className="font-semibold text-lg">Concluídas ({completed.length})</h3>
                    </div>

                    {completed.length === 0 ? (
                        <div className="text-center p-8 border border-dashed rounded-lg text-muted-foreground bg-muted/20">
                            As tarefas finalizadas aparecerão aqui.
                        </div>
                    ) : (
                        completed.map(task => (
                            <Card key={task.id} className="opacity-75 bg-muted/30">
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start gap-4">
                                        <CardTitle className="text-base line-through text-muted-foreground">{task.title}</CardTitle>
                                        <Badge variant="outline" className="text-emerald-600 border-emerald-200">Realizada</Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="pb-2">
                                    <p className="text-sm text-muted-foreground line-clamp-2">{task.description}</p>
                                </CardContent>
                                <CardFooter className="pt-2 flex justify-end">
                                    <Button variant="ghost" size="icon" onClick={() => deleteTask.mutate(task.id)} className="text-muted-foreground hover:text-red-500">
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
