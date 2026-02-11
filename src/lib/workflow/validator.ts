/**
 * Workflow Validation Engine
 * Validates workflow definitions before execution
 */

import type {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowEdge,
  ValidationResult,
  ValidationError,
  TriggerNode,
  ActionNode,
  ConditionNode,
} from '@/lib/types/workflow';

export class WorkflowValidator {
  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];

  /**
   * Validate a complete workflow definition
   */
  validate(workflow: WorkflowDefinition): ValidationResult {
    this.errors = [];
    this.warnings = [];

    // Basic validation
    this.validateBasicInfo(workflow);
    this.validateNodes(workflow.nodes);
    this.validateEdges(workflow.edges, workflow.nodes);
    this.validateStartNode(workflow.startNodeId, workflow.nodes);
    
    // Graph structure validation
    this.validateConnectivity(workflow.nodes, workflow.edges);
    this.validateCircularDependencies(workflow.nodes, workflow.edges);
    this.validateUnreachableNodes(workflow.nodes, workflow.edges, workflow.startNodeId);
    
    // Logic validation
    this.validateExitConditions(workflow.nodes, workflow.edges);
    this.validateOutcomePaths(workflow.nodes, workflow.edges);

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
    };
  }

  /**
   * Validate basic workflow information
   */
  private validateBasicInfo(workflow: WorkflowDefinition): void {
    if (!workflow.name || workflow.name.trim().length < 3) {
      this.errors.push({
        type: 'error',
        code: 'INVALID_NAME',
        message: 'Workflow name must be at least 3 characters long',
      });
    }

    if (workflow.name && workflow.name.length > 100) {
      this.errors.push({
        type: 'error',
        code: 'NAME_TOO_LONG',
        message: 'Workflow name must be less than 100 characters',
      });
    }

    if (!workflow.nodes || workflow.nodes.length === 0) {
      this.errors.push({
        type: 'error',
        code: 'NO_NODES',
        message: 'Workflow must have at least one node',
      });
    }
  }

  /**
   * Validate all nodes
   */
  private validateNodes(nodes: WorkflowNode[]): void {
    const nodeIds = new Set<string>();

    for (const node of nodes) {
      // Check for duplicate IDs
      if (nodeIds.has(node.id)) {
        this.errors.push({
          nodeId: node.id,
          type: 'error',
          code: 'DUPLICATE_NODE_ID',
          message: `Duplicate node ID: ${node.id}`,
        });
      }
      nodeIds.add(node.id);

      // Validate node-specific requirements
      switch (node.type) {
        case 'trigger':
          this.validateTriggerNode(node as TriggerNode);
          break;
        case 'action':
          this.validateActionNode(node as ActionNode);
          break;
        case 'condition':
          this.validateConditionNode(node as ConditionNode);
          break;
      }
    }
  }

  /**
   * Validate trigger node
   */
  private validateTriggerNode(node: TriggerNode): void {
    if (!node.triggerType) {
      this.errors.push({
        nodeId: node.id,
        type: 'error',
        code: 'MISSING_TRIGGER_TYPE',
        message: 'Trigger node must have a trigger type',
      });
    }

    if (!node.config || Object.keys(node.config).length === 0) {
      this.errors.push({
        nodeId: node.id,
        type: 'error',
        code: 'MISSING_TRIGGER_CONFIG',
        message: 'Trigger node must have configuration',
      });
    }

    if (!node.nextNodes || node.nextNodes.length === 0) {
      this.warnings.push({
        nodeId: node.id,
        type: 'warning',
        code: 'NO_NEXT_NODES',
        message: 'Trigger has no connected nodes',
        suggestion: 'Connect this trigger to an action or condition',
      });
    }
  }

  /**
   * Validate action node
   */
  private validateActionNode(node: ActionNode): void {
    if (!node.actionType) {
      this.errors.push({
        nodeId: node.id,
        type: 'error',
        code: 'MISSING_ACTION_TYPE',
        message: 'Action node must have an action type',
      });
    }

    if (!node.config || Object.keys(node.config).length === 0) {
      this.errors.push({
        nodeId: node.id,
        type: 'error',
        code: 'MISSING_ACTION_CONFIG',
        message: 'Action node must have configuration',
      });
    }

    // Validate outcome paths
    if (node.actionType === 'place_order' || node.actionType === 'place_options_order') {
      if (!node.outcomeNodes || Object.keys(node.outcomeNodes).length === 0) {
        this.warnings.push({
          nodeId: node.id,
          type: 'warning',
          code: 'NO_OUTCOME_PATHS',
          message: 'Order action has no outcome paths defined',
          suggestion: 'Define what happens when order is executed, rejected, or hits SL/target',
        });
      }
    }
  }

  /**
   * Validate condition node
   */
  private validateConditionNode(node: ConditionNode): void {
    if (!node.conditionType) {
      this.errors.push({
        nodeId: node.id,
        type: 'error',
        code: 'MISSING_CONDITION_TYPE',
        message: 'Condition node must have a condition type',
      });
    }

    if (!node.checks || node.checks.length === 0) {
      this.errors.push({
        nodeId: node.id,
        type: 'error',
        code: 'NO_CHECKS',
        message: 'Condition node must have at least one check',
      });
    }

    // Validate paths based on condition type
    if (node.conditionType === 'if') {
      if (!node.trueNode && !node.falseNode) {
        this.errors.push({
          nodeId: node.id,
          type: 'error',
          code: 'NO_CONDITION_PATHS',
          message: 'IF condition must have at least one path (true or false)',
        });
      }
    } else if (node.conditionType === 'any') {
      if (!node.anyNodes || node.anyNodes.length === 0) {
        this.errors.push({
          nodeId: node.id,
          type: 'error',
          code: 'NO_ANY_PATHS',
          message: 'ANY condition must have at least one path',
        });
      }
    }
  }

  /**
   * Validate edges
   */
  private validateEdges(edges: WorkflowEdge[], nodes: WorkflowNode[]): void {
    const nodeIds = new Set(nodes.map(n => n.id));

    for (const edge of edges) {
      // Check if source node exists
      if (!nodeIds.has(edge.from)) {
        this.errors.push({
          edgeId: edge.id,
          type: 'error',
          code: 'INVALID_SOURCE_NODE',
          message: `Edge references non-existent source node: ${edge.from}`,
        });
      }

      // Check if target node exists
      if (!nodeIds.has(edge.to)) {
        this.errors.push({
          edgeId: edge.id,
          type: 'error',
          code: 'INVALID_TARGET_NODE',
          message: `Edge references non-existent target node: ${edge.to}`,
        });
      }
    }
  }

  /**
   * Validate start node
   */
  private validateStartNode(startNodeId: string, nodes: WorkflowNode[]): void {
    if (!startNodeId) {
      this.errors.push({
        type: 'error',
        code: 'NO_START_NODE',
        message: 'Workflow must have a start node',
      });
      return;
    }

    const startNode = nodes.find(n => n.id === startNodeId);
    if (!startNode) {
      this.errors.push({
        type: 'error',
        code: 'INVALID_START_NODE',
        message: `Start node ${startNodeId} does not exist`,
      });
      return;
    }

    if (startNode.type !== 'trigger') {
      this.errors.push({
        nodeId: startNodeId,
        type: 'error',
        code: 'INVALID_START_NODE_TYPE',
        message: 'Start node must be a trigger',
      });
    }
  }

  /**
   * Validate graph connectivity
   */
  private validateConnectivity(nodes: WorkflowNode[], edges: WorkflowEdge[]): void {
    // Check for disconnected nodes (except start node)
    const connectedNodes = new Set<string>();
    
    for (const edge of edges) {
      connectedNodes.add(edge.from);
      connectedNodes.add(edge.to);
    }

    for (const node of nodes) {
      if (!connectedNodes.has(node.id)) {
        this.warnings.push({
          nodeId: node.id,
          type: 'warning',
          code: 'DISCONNECTED_NODE',
          message: `Node ${node.id} is not connected to the workflow`,
          suggestion: 'Connect this node or remove it',
        });
      }
    }
  }

  /**
   * Validate circular dependencies
   */
  private validateCircularDependencies(nodes: WorkflowNode[], edges: WorkflowEdge[]): void {
    const adjacencyList = new Map<string, string[]>();
    
    // Build adjacency list
    for (const edge of edges) {
      if (!adjacencyList.has(edge.from)) {
        adjacencyList.set(edge.from, []);
      }
      adjacencyList.get(edge.from)!.push(edge.to);
    }

    // DFS to detect cycles
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const neighbors = adjacencyList.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (hasCycle(neighbor)) return true;
        } else if (recursionStack.has(neighbor)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        if (hasCycle(node.id)) {
          this.errors.push({
            type: 'error',
            code: 'CIRCULAR_DEPENDENCY',
            message: 'Workflow contains circular dependencies',
            suggestion: 'Remove loops in the workflow graph',
          });
          break;
        }
      }
    }
  }

  /**
   * Validate unreachable nodes
   */
  private validateUnreachableNodes(
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    startNodeId: string
  ): void {
    const reachable = new Set<string>();
    const queue: string[] = [startNodeId];

    // BFS to find all reachable nodes
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (reachable.has(current)) continue;
      
      reachable.add(current);

      // Find all edges from current node
      const outgoingEdges = edges.filter(e => e.from === current);
      for (const edge of outgoingEdges) {
        if (!reachable.has(edge.to)) {
          queue.push(edge.to);
        }
      }
    }

    // Check for unreachable nodes
    for (const node of nodes) {
      if (!reachable.has(node.id)) {
        this.warnings.push({
          nodeId: node.id,
          type: 'warning',
          code: 'UNREACHABLE_NODE',
          message: `Node ${node.id} is unreachable from start node`,
          suggestion: 'Connect this node to the workflow or remove it',
        });
      }
    }
  }

  /**
   * Validate exit conditions
   */
  private validateExitConditions(nodes: WorkflowNode[], edges: WorkflowEdge[]): void {
    // Check if workflow has at least one terminal node (no outgoing edges)
    const nodesWithOutgoing = new Set(edges.map(e => e.from));
    const terminalNodes = nodes.filter(n => !nodesWithOutgoing.has(n.id));

    if (terminalNodes.length === 0) {
      this.warnings.push({
        type: 'warning',
        code: 'NO_EXIT_CONDITION',
        message: 'Workflow has no exit conditions',
        suggestion: 'Add a stop automation or square off action',
      });
    }

    // Check for workflows with only actions and no exit logic
    const hasStopAction = nodes.some(
      n => n.type === 'action' && 
      (n as ActionNode).actionType === 'stop_automation'
    );

    if (!hasStopAction && nodes.length > 2) {
      this.warnings.push({
        type: 'warning',
        code: 'NO_STOP_ACTION',
        message: 'Workflow has no stop automation action',
        suggestion: 'Add a stop automation action to properly end the workflow',
      });
    }
  }

  /**
   * Validate outcome paths for action nodes
   */
  private validateOutcomePaths(nodes: WorkflowNode[], edges: WorkflowEdge[]): void {
    for (const node of nodes) {
      if (node.type !== 'action') continue;

      const actionNode = node as ActionNode;
      
      // For order placement actions, check if outcome paths are defined
      if (
        actionNode.actionType === 'place_order' ||
        actionNode.actionType === 'place_options_order'
      ) {
        const outcomes = actionNode.outcomeNodes;
        
        if (outcomes.target_hit || outcomes.sl_hit) {
          // If SL/Target are defined, check if they're connected
          if (outcomes.target_hit) {
            const hasTargetEdge = edges.some(
              e => e.from === node.id && e.condition === 'target_hit'
            );
            if (!hasTargetEdge) {
              this.warnings.push({
                nodeId: node.id,
                type: 'warning',
                code: 'MISSING_TARGET_PATH',
                message: 'Target outcome is defined but not connected',
                suggestion: 'Connect the target hit path to a node',
              });
            }
          }

          if (outcomes.sl_hit) {
            const hasSlEdge = edges.some(
              e => e.from === node.id && e.condition === 'sl_hit'
            );
            if (!hasSlEdge) {
              this.warnings.push({
                nodeId: node.id,
                type: 'warning',
                code: 'MISSING_SL_PATH',
                message: 'Stop loss outcome is defined but not connected',
                suggestion: 'Connect the stop loss hit path to a node',
              });
            }
          }
        }
      }
    }
  }
}

/**
 * Convenience function to validate a workflow
 */
export function validateWorkflow(workflow: WorkflowDefinition): ValidationResult {
  const validator = new WorkflowValidator();
  return validator.validate(workflow);
}
