import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { costsApi, type ModelPrice } from "../api/costs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, RotateCw } from "lucide-react";
import { cn } from "../lib/utils";

interface ModelPriceForm {
  modelName: string;
  inputCostPerMillion: string;
  outputCostPerMillion: string;
  cachedInputCostPerMillion: string;
}

interface EditingModel {
  modelName: string | null;
  form: ModelPriceForm;
}

export function ModelPricesPanel() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<EditingModel>({
    modelName: null,
    form: {
      modelName: "",
      inputCostPerMillion: "",
      outputCostPerMillion: "",
      cachedInputCostPerMillion: "",
    },
  });

  // Fetch model prices
  const { data: prices = [], isLoading } = useQuery({
    queryKey: ["modelPrices"],
    queryFn: () => costsApi.listModelPrices(),
  });

  // Mutations
  const upsertMutation = useMutation({
    mutationFn: async () => {
      const input = Number(editing.form.inputCostPerMillion) || 0;
      const output = Number(editing.form.outputCostPerMillion) || 0;
      const cached = Number(editing.form.cachedInputCostPerMillion) || 0;

      return costsApi.upsertModelPrice(editing.form.modelName, {
        inputCostPerMillion: input,
        outputCostPerMillion: output,
        cachedInputCostPerMillion: cached,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["modelPrices"] });
      setEditing({
        modelName: null,
        form: {
          modelName: "",
          inputCostPerMillion: "",
          outputCostPerMillion: "",
          cachedInputCostPerMillion: "",
        },
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (modelName: string) => costsApi.deleteModelPrice(modelName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["modelPrices"] });
    },
  });

  const recalculateMutation = useMutation({
    mutationFn: () => {
      // TODO: Get company ID from context
      return costsApi.recalculateModelPrices("default");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["modelPrices"] });
    },
  });

  const handleEdit = (price: ModelPrice) => {
    setEditing({
      modelName: price.modelName,
      form: {
        modelName: price.modelName,
        inputCostPerMillion: (price.inputCostPerMillion / 100).toFixed(2),
        outputCostPerMillion: (price.outputCostPerMillion / 100).toFixed(2),
        cachedInputCostPerMillion: (price.cachedInputCostPerMillion / 100).toFixed(2),
      },
    });
  };

  const handleSave = () => {
    if (!editing.form.modelName.trim()) {
      return;
    }
    upsertMutation.mutate();
  };

  const handleCancel = () => {
    setEditing({
      modelName: null,
      form: {
        modelName: "",
        inputCostPerMillion: "",
        outputCostPerMillion: "",
        cachedInputCostPerMillion: "",
      },
    });
  };

  const handleNewModel = () => {
    setEditing({
      modelName: null,
      form: {
        modelName: "",
        inputCostPerMillion: "",
        outputCostPerMillion: "",
        cachedInputCostPerMillion: "",
      },
    });
  };

  const isEditing = editing.modelName !== null;

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle>Custom Model Prices</CardTitle>
        <CardDescription>
          Define pricing for models that don't report costs through their provider
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Model Prices Table */}
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="font-semibold text-left p-3">Model</th>
                <th className="font-semibold text-right p-3">Input ($/1M)</th>
                <th className="font-semibold text-right p-3">Output ($/1M)</th>
                <th className="font-semibold text-right p-3">Cached ($/1M)</th>
                <th className="w-32"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="text-center text-muted-foreground py-8">
                    Loading...
                  </td>
                </tr>
              ) : prices.length === 0 && !isEditing ? (
                <tr>
                  <td colSpan={5} className="text-center text-muted-foreground py-8">
                    No model prices configured
                  </td>
                </tr>
              ) : (
                <>
                  {prices.map((price) => (
                    <tr key={price.modelName} className="border-b hover:bg-muted/30">
                      <td className="font-mono text-sm p-3">{price.modelName}</td>
                      <td className="text-right font-mono text-sm p-3">
                        {(price.inputCostPerMillion / 100).toFixed(2)}
                      </td>
                      <td className="text-right font-mono text-sm p-3">
                        {(price.outputCostPerMillion / 100).toFixed(2)}
                      </td>
                      <td className="text-right font-mono text-sm p-3">
                        {(price.cachedInputCostPerMillion / 100).toFixed(2)}
                      </td>
                      <td className="text-right p-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(price)}
                            disabled={isEditing}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteMutation.mutate(price.modelName)}
                            disabled={isEditing}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {isEditing && (
                    <tr className="border-b bg-blue-50 dark:bg-blue-950">
                      <td className="p-3">
                        <Input
                          placeholder="model-name"
                          value={editing.form.modelName}
                          onChange={(e) =>
                            setEditing({
                              ...editing,
                              form: { ...editing.form, modelName: e.target.value },
                            })
                          }
                          disabled={editing.modelName !== null}
                          className="font-mono text-sm"
                        />
                      </td>
                      <td className="p-3">
                        <Input
                          type="number"
                          placeholder="0.00"
                          step="0.01"
                          value={editing.form.inputCostPerMillion}
                          onChange={(e) =>
                            setEditing({
                              ...editing,
                              form: { ...editing.form, inputCostPerMillion: e.target.value },
                            })
                          }
                          className="text-right font-mono text-sm"
                        />
                      </td>
                      <td className="p-3">
                        <Input
                          type="number"
                          placeholder="0.00"
                          step="0.01"
                          value={editing.form.outputCostPerMillion}
                          onChange={(e) =>
                            setEditing({
                              ...editing,
                              form: { ...editing.form, outputCostPerMillion: e.target.value },
                            })
                          }
                          className="text-right font-mono text-sm"
                        />
                      </td>
                      <td className="p-3">
                        <Input
                          type="number"
                          placeholder="0.00"
                          step="0.01"
                          value={editing.form.cachedInputCostPerMillion}
                          onChange={(e) =>
                            setEditing({
                              ...editing,
                              form: { ...editing.form, cachedInputCostPerMillion: e.target.value },
                            })
                          }
                          className="text-right font-mono text-sm"
                        />
                      </td>
                      <td className="text-right p-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={handleSave}
                            disabled={upsertMutation.isPending}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCancel}
                            disabled={upsertMutation.isPending}
                          >
                            Cancel
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {!isEditing && (
            <Button onClick={handleNewModel} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Model
            </Button>
          )}
          <Button
            onClick={() => recalculateMutation.mutate()}
            variant="outline"
            size="sm"
            disabled={recalculateMutation.isPending}
          >
            <RotateCw className={cn("w-4 h-4 mr-2", recalculateMutation.isPending && "animate-spin")} />
            {recalculateMutation.isPending ? "Recalculating..." : "Recalculate"}
          </Button>
        </div>

        {/* Status Messages */}
        {recalculateMutation.isSuccess && (
          <div className="p-3 bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200 rounded text-sm">
            ✓ {recalculateMutation.data?.updatedCount || 0} records recalculated
          </div>
        )}
      </CardContent>
    </Card>
  );
}
