"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import {
    ReactFlow,
    Node,
    Edge,
    addEdge,
    Connection,
    useNodesState,
    useEdgesState,
    Controls,
    Background,
    BackgroundVariant,
    Handle,
    Position,
    BaseEdge,
    EdgeLabelRenderer,
    getStraightPath,
    EdgeProps,
    ReactFlowInstance
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import Image from "next/image"

interface PaymentFlowVisualizationProps {
  storeId: string
  activePsps: Array<{
    id: string
    name: string
    pspType: string
    totalPayments: number
    successfulPayments: number
    totalRevenue: number
    conversionRate: number
  }>
  routingMode: "automatic" | "manual"
  weights: {[pspId: string]: number}
  fallbackConfig: {
    enabled: boolean
    maxRetries: number
    psps: Array<{ id: string, name: string, order: number }>
  }
}

// Composant Edge personnalisé avec label stylé
const CustomEdge = ({ id, sourceX, sourceY, targetX, targetY, label, style }: EdgeProps) => {
  const [edgePath, labelX, labelY] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  })

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="bg-white border-2 border-gray-300 rounded-full px-3 py-1 text-xs font-semibold text-gray-900 shadow-md"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

// Composant PSP Node personnalisé
const PSPNode = ({ data, isConnectable }: { data: { percentage?: string; logo?: string; name: string; identifier: string; capacity: string; status: string }; isConnectable: boolean }) => {
  const isFallback = data.percentage?.includes('Fallback')
  
  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={isConnectable}
        className="w-3 h-3 !bg-green-500 !border-2 !border-green-400"
      />
      
      <div className={`bg-white rounded-xl p-4 min-w-[220px] shadow-lg border-2 ${
        isFallback ? 'border-orange-400' : 'border-green-400'
      }`}>
        <div className="flex items-center gap-3 mb-4">
          <Image
            src={data.logo || "/stripe.png"}
            alt={data.name}
            width={32}
            height={32}
            className="rounded"
          />
          <div className="flex-1">
            <div className="font-bold text-xl text-gray-900">{data.name}</div>
            <div className="text-sm text-gray-500 font-medium">{data.identifier}</div>
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 font-medium">Capacité:</span>
            <div className="bg-gray-100 text-gray-800 px-3 py-1 rounded-lg text-sm font-semibold border">
              {data.capacity}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="bg-gray-100 text-gray-800 px-3 py-1 rounded-lg text-sm font-semibold">
              {data.percentage}
            </div>
            <div className="bg-green-100 text-green-800 px-3 py-1 rounded-lg text-sm font-semibold border border-green-300">
              {data.status}
            </div>
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
        className="w-3 h-3 !bg-green-500 !border-2 !border-green-400"
      />
    </>
  )
}

// Composant Route Node
const RouteNode = ({ data, isConnectable }: { data: { label: string; subtitle: string }; isConnectable: boolean }) => {
  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={isConnectable}
        className="w-3 h-3 !bg-purple-500 !border-2 !border-purple-400"
      />
      
      <div className="bg-purple-600 text-white rounded-full px-8 py-6 shadow-xl border-4 border-purple-300">
        <div className="text-center">
          <div className="font-bold text-xl">{data.label}</div>
          <div className="text-sm opacity-90 mt-1">{data.subtitle}</div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
        className="w-3 h-3 !bg-purple-500 !border-2 !border-purple-400"
      />
    </>
  )
}

// Composant Start/End Node
const ActionNode = ({ data, isConnectable }: { data: { type: string; label: string; subtitle?: string }; isConnectable: boolean }) => {
  const bgColor = data.type === 'start' ? 'bg-blue-600' : 
                  data.type === 'success' ? 'bg-green-600' : 'bg-red-600'
  const borderColor = data.type === 'start' ? 'border-blue-300' : 
                      data.type === 'success' ? 'border-green-300' : 'border-red-300'
  
  return (
    <>
      {data.type !== 'start' && (
        <Handle
          type="target"
          position={Position.Left}
          isConnectable={isConnectable}
          className={`w-3 h-3 !border-2 ${
            data.type === 'success' 
              ? '!bg-green-500 !border-green-400' 
              : '!bg-red-500 !border-red-400'
          }`}
        />
      )}
      
      <div className={`${bgColor} ${borderColor} text-white rounded-xl px-8 py-6 shadow-xl border-4`}>
        <div className="text-center">
          <div className="font-bold text-xl">{data.label}</div>
          <div className="text-sm opacity-90 mt-1">{data.subtitle}</div>
        </div>
      </div>

      {data.type === 'start' && (
        <Handle
          type="source"
          position={Position.Right}
          isConnectable={isConnectable}
          className="w-3 h-3 !bg-blue-500 !border-2 !border-blue-400"
        />
      )}
    </>
  )
}

// Types de nodes et edges personnalisés
const nodeTypes = {
  pspNode: PSPNode,
  routeNode: RouteNode,
  actionNode: ActionNode,
}

const edgeTypes = {
  customEdge: CustomEdge,
}

// Fonction pour formater les noms des PSP
const formatPspName = (pspType: string): string => {
  switch (pspType.toLowerCase()) {
    case 'stripe':
      return 'Stripe'
    case 'checkout':
      return 'Checkout.com'
    case 'paypal':
      return 'PayPal'
    default:
      return pspType.charAt(0).toUpperCase() + pspType.slice(1)
  }
}

export function PaymentFlowVisualization({ 
  storeId, 
  activePsps, 
  routingMode, 
  weights, 
  fallbackConfig 
}: PaymentFlowVisualizationProps) {
  const [flowView, setFlowView] = useState<"diagram" | "table">("diagram")
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null)

  // Générer les nodes dynamiquement
  const generateNodes = (): Node[] => {
    const nodes: Node[] = []
    let xOffset = 50
    let yOffset = 250

    // Start node
    nodes.push({
      id: 'start',
      type: 'actionNode',
      position: { x: xOffset, y: yOffset },
      data: { 
        label: 'DÉMARRAGE', 
        subtitle: 'Transaction Initiée',
        type: 'start'
      }
    })

    xOffset += 300

    // Route node
    nodes.push({
      id: 'route',
      type: 'routeNode',
      position: { x: xOffset, y: yOffset },
      data: { 
        label: 'ROUTE', 
        subtitle: routingMode === 'automatic' ? 'Routage Intelligent' : 'Sélection Ponderée'
      }
    })

    xOffset += 300

    // PSP nodes
    const pspNodes = activePsps.map((psp, index) => {
      const weight = routingMode === 'manual' ? weights[psp.id] || 0 : Math.round(100 / activePsps.length)
      const yPos = yOffset - 150 + (index * 150)
      
      return {
        id: `psp-${psp.id}`,
        type: 'pspNode',
        position: { x: xOffset, y: yPos },
        data: { 
          name: psp.name,
          identifier: formatPspName(psp.pspType),
          logo: `/${psp.pspType}.png`,
          capacity: 'Sans limite',
          percentage: routingMode === 'manual' ? `${weight}%` : 'Auto',
          status: 'Actif'
        }
      }
    })

    nodes.push(...pspNodes)

    xOffset += 350

    // Result node
    nodes.push({
      id: 'result',
      type: 'routeNode',
      position: { x: xOffset, y: yOffset },
      data: { 
        label: 'RÉSULTAT', 
        subtitle: 'Succès ou Échec?'
      }
    })

    xOffset += 300

    // Success node
    nodes.push({
      id: 'success',
      type: 'actionNode',
      position: { x: xOffset, y: yOffset - 100 },
      data: { 
        label: 'SUCCÈS', 
        subtitle: 'Transaction Terminée',
        type: 'success'
      }
    })

    // Fallback nodes (si activé)
    if (fallbackConfig.enabled && fallbackConfig.psps.length > 0) {
      xOffset = 1000
      yOffset = 450

      fallbackConfig.psps.forEach((fallbackPsp, index) => {
        // Chercher d'abord dans activePsps, sinon utiliser les infos de fallbackConfig
        const psp = activePsps.find(p => p.id === fallbackPsp.id)
        const pspType = psp?.pspType || 'stripe' // fallback par défaut
        const pspName = psp?.name || fallbackPsp.name
        
        nodes.push({
          id: `fallback-${fallbackPsp.id}`,
          type: 'pspNode',
          position: { x: xOffset + (index * 300), y: yOffset },
          data: { 
            name: pspName,
            identifier: formatPspName(pspType),
            logo: `/${pspType}.png`,
            capacity: 'Sans limite',
            percentage: `Secours #${fallbackPsp.order}`,
            status: 'Actif'
          }
        })
      })

      // Failure node
      nodes.push({
        id: 'failure',
        type: 'actionNode',
        position: { x: xOffset + (fallbackConfig.psps.length * 300), y: yOffset + 100 },
        data: { 
          label: 'ÉCHEC', 
          subtitle: 'Transaction Échouée',
          type: 'failure'
        }
      })
    }

    return nodes
  }

  // Générer les edges dynamiquement
  const generateEdges = (): Edge[] => {
    const edges: Edge[] = []
    let edgeId = 0

    // Start -> Route
    edges.push({
      id: `edge-${edgeId++}`,
      source: 'start',
      target: 'route',
      animated: true,
      style: { stroke: '#4F46E5', strokeWidth: 3 }
    })

    // Route -> PSPs
    activePsps.forEach((psp, index) => {
      const weight = routingMode === 'manual' ? weights[psp.id] || 0 : Math.round(100 / activePsps.length)
      edges.push({
        id: `edge-${edgeId++}`,
        source: 'route',
        target: `psp-${psp.id}`,
        type: 'customEdge',
        label: routingMode === 'manual' ? `${weight}%` : 'Auto',
        style: { stroke: '#10B981', strokeWidth: 3 }
      })

      // PSP -> Result
      edges.push({
        id: `edge-${edgeId++}`,
        source: `psp-${psp.id}`,
        target: 'result',
        style: { stroke: '#10B981', strokeWidth: 2 }
      })
    })

    // Result -> Success
    edges.push({
      id: `edge-${edgeId++}`,
      source: 'result',
      target: 'success',
      type: 'customEdge',
      label: 'Succès',
      style: { stroke: '#10B981', strokeWidth: 3 }
    })

    // Result -> Fallback (si activé)
    if (fallbackConfig.enabled && fallbackConfig.psps.length > 0) {
      edges.push({
        id: `edge-${edgeId++}`,
        source: 'result',
        target: `fallback-${fallbackConfig.psps[0].id}`,
        type: 'customEdge',
        label: `Secours #${fallbackConfig.psps[0].order}`,
        style: { stroke: '#F59E0B', strokeWidth: 3 }
      })

      // Fallback chain
      for (let i = 0; i < fallbackConfig.psps.length - 1; i++) {
        edges.push({
          id: `edge-${edgeId++}`,
          source: `fallback-${fallbackConfig.psps[i].id}`,
          target: `fallback-${fallbackConfig.psps[i + 1].id}`,
          style: { stroke: '#F59E0B', strokeWidth: 2 }
        })
      }

      // Last fallback -> Failure
      if (fallbackConfig.psps.length > 0) {
        edges.push({
          id: `edge-${edgeId++}`,
          source: `fallback-${fallbackConfig.psps[fallbackConfig.psps.length - 1].id}`,
          target: 'failure',
          type: 'customEdge',
          label: 'Échec Final',
          style: { stroke: '#EF4444', strokeWidth: 3 }
        })
      }
    }

    return edges
  }

  const [nodes, setNodes, onNodesChange] = useNodesState(generateNodes())
  const [edges, setEdges, onEdgesChange] = useEdgesState(generateEdges())
  
  const onConnect = useCallback((params: Edge | Connection) => setEdges((eds) => addEdge(params, eds)), [setEdges])

  // Mettre à jour les nodes et edges quand les données changent
  const updateFlow = useCallback(() => {
    setNodes(generateNodes())
    setEdges(generateEdges())
  }, [activePsps, routingMode, weights, fallbackConfig])

  // Mettre à jour le flow quand les données changent
  useEffect(() => {
    updateFlow()
    // Ajuster la vue après la mise à jour
    if (reactFlowInstance.current) {
      setTimeout(() => {
        reactFlowInstance.current?.fitView({ padding: 0.1 })
      }, 100)
    }
  }, [updateFlow])

  const onInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstance.current = instance
    instance.fitView({ padding: 0.1 })
  }, [])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20">
              <div className="w-3 h-3 rounded-full bg-primary animate-pulse"></div>
            </div>
            Visualisation du Flow de Paiement
          </CardTitle>
          
          {/* Tabs Flow */}
          <div className="flex space-x-1 bg-muted p-1 rounded-lg">
            <button
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                flowView === "diagram" 
                  ? "bg-background text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setFlowView("diagram")}
            >
              Diagramme
            </button>
            <button
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                flowView === "table" 
                  ? "bg-background text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setFlowView("table")}
            >
              Tableau
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {flowView === "diagram" ? (
          <div className="h-[600px] border rounded-lg overflow-hidden">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView
              nodesDraggable={true}
              nodesConnectable={false}
              elementsSelectable={true}
              selectNodesOnDrag={false}
              onInit={onInit}
            >
              <Controls />
              <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
            </ReactFlow>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Section Primary Routing */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
                <h4 className="text-xl font-semibold">Routage Principal</h4>
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                  {routingMode === 'automatic' ? 'Sélection Automatique' : 'Répartition Pondérée'}
                </Badge>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>PSP</TableHead>
                      <TableHead>Capacité</TableHead>
                      <TableHead>Répartition</TableHead>
                      <TableHead className="text-right">Action si échec</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activePsps.map((psp, index) => {
                      const weight = routingMode === 'manual' ? weights[psp.id] || 0 : Math.round(100 / activePsps.length)
                      return (
                        <TableRow key={psp.id} className="border-b border-muted/20 hover:bg-green-500/5">
                          <TableCell>
                            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-sm font-semibold text-green-400">
                              {index + 1}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Image
                                src={`/${psp.pspType}.png`}
                                alt={psp.name}
                                width={24}
                                height={24}
                                className="rounded"
                              />
                              <div>
                                <div className="font-semibold">{psp.name}</div>
                                <div className="text-xs text-muted-foreground">{formatPspName(psp.pspType)}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-gray-100 text-gray-800">
                              €50,000/mois
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {routingMode === 'automatic' ? (
                              <Badge variant="outline" className="bg-blue-100 text-blue-800">
                                Automatique
                              </Badge>
                            ) : (
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-green-500" 
                                    style={{ width: `${weight}%` }}
                                  ></div>
                                </div>
                                <span className="text-sm font-medium">{weight}%</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-sm text-orange-500">→ Secours</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Section Fallback Sequence */}
            {fallbackConfig.enabled && fallbackConfig.psps.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center">
                    <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                  </div>
                  <h4 className="text-xl font-semibold">Séquence Fallback</h4>
                  <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                    Max {fallbackConfig.maxRetries} Tentative{fallbackConfig.maxRetries > 1 ? 's' : ''}
                  </Badge>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-orange-500/5">
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>PSP</TableHead>
                        <TableHead className="text-right">Ordre Fallback</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fallbackConfig.psps
                        .sort((a, b) => a.order - b.order)
                        .map((fallbackPsp, index) => {
                          const psp = activePsps.find(p => p.id === fallbackPsp.id)
                          const pspType = psp?.pspType || 'stripe'
                          const pspName = psp?.name || fallbackPsp.name
                          
                          return (
                            <TableRow key={fallbackPsp.id} className="border-b border-muted/20 hover:bg-orange-500/5">
                              <TableCell>
                                <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center text-sm font-semibold text-orange-400">
                                  {index + 1}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <Image
                                    src={`/${pspType}.png`}
                                    alt={pspName}
                                    width={24}
                                    height={24}
                                    className="rounded"
                                  />
                                  <div>
                                    <div className="font-semibold">{pspName}</div>
                                    <div className="text-xs text-muted-foreground">{formatPspName(pspType)}</div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge variant="outline" className="bg-orange-500/20 text-orange-400">
                                  Secours {fallbackPsp.order}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
