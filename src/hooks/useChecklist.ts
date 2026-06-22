import { useState, useCallback, useEffect, useRef } from 'react';
import * as db from '../database/db';
import {
  ChecklistInstance,
  ChecklistResult,
  TemplateItem,
} from '../types/database';
import { runSync } from '../services/sync';

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

const SYNC_INTERVAL_MS = 30000;

/** Patch passed to {@link useChecklist.updateItem}. */
export interface ItemPatch {
  status?: ChecklistResult['status'];
  comments?: string | null;
  photoUri?: string | null;
}

export const useChecklist = (instanceId: string | null) => {
  const [state, setState] = useState<ChecklistState>(INITIAL_STATE);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Guards against overlapping sync passes without forcing re-renders.
  const syncingRef = useRef(false);

  useEffect(() => {
    if (!instanceId) {
      setState(INITIAL_STATE);
      return;
    }

    let cancelled = false;

    const loadChecklist = async () => {
      try {
        setState((prev) => ({ ...prev, loading: true, error: null }));

        const instance = await db.getChecklistInstanceById(instanceId);
        if (!instance) {
          if (!cancelled) {
            setState((prev) => ({
              ...prev,
              error: 'Checklist not found',
              loading: false,
            }));
          }
          return;
        }

        const items = await db.getTemplateItemsByTemplate(instance.template_id);
        const results = await db.getChecklistResultsByInstance(instanceId);

        const resultsMap = new Map<string, ChecklistResult>();
        results.forEach((result) => {
          resultsMap.set(result.template_item_id, result);
        });

        if (!cancelled) {
          setState({
            instance,
            items,
            results: resultsMap,
            loading: false,
            syncing: false,
            error: null,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            error:
              error instanceof Error ? error.message : 'Failed to load checklist',
            loading: false,
          }));
        }
      }
    };

    loadChecklist();
    return () => {
      cancelled = true;
    };
  }, [instanceId]);

  const attemptSync = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setState((prev) => ({ ...prev, syncing: true }));

    try {
      await runSync();
    } finally {
      syncingRef.current = false;
      setState((prev) => ({ ...prev, syncing: false }));
    }
  }, []);

  /**
   * Creates or patches the result for a checklist item. Omitted patch fields
   * are preserved; a new row requires at least a `status`.
   */
  const updateItem = useCallback(
    async (templateItemId: string, patch: ItemPatch) => {
      const instance = state.instance;
      if (!instance) return;

      try {
        const existing = state.results.get(templateItemId);
        let resultId: string;

        if (existing) {
          await db.updateChecklistResult(existing.id, {
            status: patch.status,
            comments: patch.comments,
            photoUri: patch.photoUri,
          });
          resultId = existing.id;
        } else {
          if (!patch.status) {
            // Can't create a result row without a status (NOT NULL); ignore.
            return;
          }
          const created = await db.createChecklistResult(
            instance.id,
            templateItemId,
            patch.status,
            patch.comments ?? undefined,
            patch.photoUri ?? undefined
          );
          resultId = created.id;
        }

        const fresh = await db.getChecklistResultById(resultId);
        if (fresh) {
          setState((prev) => ({
            ...prev,
            results: new Map(prev.results).set(templateItemId, fresh),
          }));
        }

        attemptSync();
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to update item',
        }));
      }
    },
    [state.instance, state.results, attemptSync]
  );

  /** Convenience wrapper used by the Pass/Fail/N/A buttons. */
  const updateItemStatus = useCallback(
    (templateItemId: string, status: ChecklistResult['status']) =>
      updateItem(templateItemId, { status }),
    [updateItem]
  );

  const completeChecklist = useCallback(
    async (inspectorSignature: string, pmSignature?: string) => {
      if (!state.instance) return;

      try {
        await db.signOffChecklistInstance(
          state.instance.id,
          inspectorSignature,
          pmSignature
        );

        const updated = await db.getChecklistInstanceById(state.instance.id);
        if (updated) {
          setState((prev) => ({ ...prev, instance: updated }));
        }

        attemptSync();
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to complete checklist',
        }));
      }
    },
    [state.instance, attemptSync]
  );

  // Periodic background sync.
  useEffect(() => {
    syncIntervalRef.current = setInterval(() => {
      attemptSync();
    }, SYNC_INTERVAL_MS);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [attemptSync]);

  const manualSync = useCallback(async () => {
    await attemptSync();
  }, [attemptSync]);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    updateItem,
    updateItemStatus,
    completeChecklist,
    manualSync,
    clearError,
  };
};
