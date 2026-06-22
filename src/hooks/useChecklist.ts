import { useState, useCallback, useEffect, useRef } from 'react';
import * as db from '../database/db';
import {
  ChecklistInstance,
  ChecklistResult,
  TemplateItem,
  ItemStatus,
  SyncPayload,
} from '../types/database';
import axios from 'axios';

interface ChecklistState {
  instance: ChecklistInstance | null;
  items: TemplateItem[];
  results: Map<string, ChecklistResult>;
  loading: boolean;
  syncing: boolean;
  error: string | null;
}

const INITIAL_STATE: ChecklistState = {
  instance: null,
  items: [],
  results: new Map(),
  loading: false,
  syncing: false,
  error: null,
};

export const useChecklist = (instanceId: string | null) => {
  const [state, setState] = useState<ChecklistState>(INITIAL_STATE);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!instanceId) {
      setState(INITIAL_STATE);
      return;
    }

    const loadChecklist = async () => {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }));

        const instance = await db.getChecklistInstanceById(instanceId);
        if (!instance) {
          setState(prev => ({ ...prev, error: 'Checklist not found', loading: false }));
          return;
        }

        const items = await db.getTemplateItemsByTemplate(instance.template_id);
        const results = await db.getChecklistResultsByInstance(instanceId);

        const resultsMap = new Map<string, ChecklistResult>();
        results.forEach(result => {
          resultsMap.set(result.template_item_id, result);
        });

        setState({
          instance,
          items,
          results: resultsMap,
          loading: false,
          syncing: false,
          error: null,
        });
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to load checklist',
          loading: false,
        }));
      }
    };

    loadChecklist();
  }, [instanceId]);

  const updateItemStatus = useCallback(
    async (templateItemId: string, status: ItemStatus, comments?: string, photoUri?: string) => {
      if (!state.instance) return;

      try {
        const existing = state.results.get(templateItemId);

        if (existing) {
          await db.updateChecklistResult(existing.id, status, comments, photoUri);
        } else {
          await db.createChecklistResult(
            state.instance.id,
            templateItemId,
            status,
            comments,
            photoUri
          );
        }

        // Update local state
        const result = await db.getChecklistResultById(
          existing?.id || (await db.getChecklistResultsByInstance(state.instance.id))[0]?.id || ''
        );

        if (result) {
          setState(prev => ({
            ...prev,
            results: new Map(prev.results).set(templateItemId, result),
          }));
        }

        // Trigger sync if online
        attemptSync();
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to update item',
        }));
      }
    },
    [state.instance]
  );

  const completeChecklist = useCallback(
    async (inspectorSignature: string, pmSignature?: string) => {
      if (!state.instance) return;

      try {
        await db.signOffChecklistInstance(state.instance.id, inspectorSignature, pmSignature);

        const updated = await db.getChecklistInstanceById(state.instance.id);
        if (updated) {
          setState(prev => ({ ...prev, instance: updated }));
        }

        // Trigger sync
        attemptSync();
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to complete checklist',
        }));
      }
    },
    [state.instance]
  );

  const attemptSync = useCallback(async () => {
    if (state.syncing) return;

    setState(prev => ({ ...prev, syncing: true }));

    try {
      const payload = await db.getPendingSyncPayload();

      if (payload.results.length === 0 && payload.punchItems.length === 0) {
        setState(prev => ({ ...prev, syncing: false }));
        return;
      }

      // Stub function - replace with actual API endpoint
      const syncedIds = await syncToBackend(payload);

      if (syncedIds.resultIds.length > 0 || syncedIds.punchItemIds.length > 0) {
        await db.markAsSynced(
          syncedIds.resultIds,
          syncedIds.punchItemIds,
          syncedIds.instanceIds
        );
      }

      setState(prev => ({ ...prev, syncing: false }));
    } catch (error) {
      console.error('Sync error:', error);
      setState(prev => ({ ...prev, syncing: false }));
    }
  }, [state.syncing]);

  // Setup periodic sync
  useEffect(() => {
    syncIntervalRef.current = setInterval(() => {
      attemptSync();
    }, 30000); // Try sync every 30 seconds

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [attemptSync]);

  const manualSync = useCallback(async () => {
    await attemptSync();
  }, [attemptSync]);

  return {
    ...state,
    updateItemStatus,
    completeChecklist,
    manualSync,
  };
};

async function syncToBackend(payload: SyncPayload): Promise<{
  resultIds: string[];
  punchItemIds: string[];
  instanceIds: string[];
}> {
  try {
    // TODO: Replace with actual backend URL
    const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3000';

    const response = await axios.post(`${BACKEND_URL}/api/sync`, payload, {
      timeout: 10000,
    });

    if (response.status === 200) {
      return {
        resultIds: payload.results.map(r => r.id),
        punchItemIds: payload.punchItems.map(p => p.id),
        instanceIds: payload.instances.map(i => i.id),
      };
    }

    return { resultIds: [], punchItemIds: [], instanceIds: [] };
  } catch (error) {
    // Network error - will retry next time
    console.error('Backend sync failed:', error);
    return { resultIds: [], punchItemIds: [], instanceIds: [] };
  }
}
