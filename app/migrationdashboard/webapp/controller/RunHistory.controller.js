sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageToast",
  "sap/ui/core/Item"
], function (Controller, JSONModel, MessageToast) {
  "use strict";

  return Controller.extend("migrationdashboard.controller.RunHistory", {
    onInit: function () {
      const model = new JSONModel({
        summary: {
          totalRuns: 0,
          successfulRuns: 0,
          lastRunDisplay: "-",
          lastRunDatabase: "-",
          avgDurationDisplay: "-"
        },
        runs: [],
        filters: {
          statusItems: [
            { key: "all", text: "All Status" },
            { key: "SUCCESS", text: "Successful" },
            { key: "FAILED", text: "Failed" },
            { key: "RUNNING", text: "Running" }
          ],
          typeItems: [
            { key: "all", text: "All Types" },
            { key: "FULL", text: "Full Assessment" },
            { key: "QUICK", text: "Quick Scan" },
            { key: "PERF", text: "Performance Only" }
          ],
          timeItems: [
            { key: "30d", text: "Last 30 days" },
            { key: "7d", text: "Last 7 days" },
            { key: "90d", text: "Last 90 days" },
            { key: "all", text: "All time" }
          ]
        }
      });

      this.getView().setModel(model, "runHistoryModel");

      // Ensure table is populated when landing on this page.
      this._loadRunHistory();
    },

    _requireConnectionId: function () {
      const id = this.getView().getModel("connections")?.getProperty?.("/selectedConnectionId") || this.getOwnerComponent?.selectedConnectionId;
      return this.controller?.selectedConnectionId || this.getOwnerComponent()?.selectedConnectionId || this.selectedConnectionId || window.selectedConnectionId || id;
    },

    _loadRunHistory: async function (params = {}) {
      try {
        const connectionId = this.selectedConnectionId || window.selectedConnectionId || this.getView()._selectedConnectionId;
        if (!connectionId) {
          // No connection yet; show empty state.
          this.getView().getModel("runHistoryModel").setProperty("/runs", []);
          return;
        }

        const qs = new URLSearchParams({ connectionId, ...params });
        const response = await fetch(`/runHistory?${qs.toString()}`);
        const result = await response.json();

        if (result.success) {
          this.getView().getModel("runHistoryModel").setProperty("/summary", result.summary || {});
          this.getView().getModel("runHistoryModel").setProperty("/runs", result.runs || []);
        } else {
          MessageToast.show(result.error || "Failed to load run history");
        }
      } catch (e) {
        console.error(e);
        MessageToast.show("Failed to load run history");
      }
    },

    onNavBack: function () {
      this.getView().getParent().back();
    },

    onSearchLiveChange: function (oEvent) {
      const q = oEvent.getParameter("newValue");
      this._loadRunHistory({ q: q || "" });
    },

    onFilterChangeStatus: function (oEvent) {
      const status = oEvent.getSource().getSelectedKey();
      this._loadRunHistory({ status });
    },

    onFilterChangeType: function (oEvent) {
      const runType = oEvent.getSource().getSelectedKey();
      this._loadRunHistory({ runType });
    },

    onFilterChangeRange: function (oEvent) {
      const range = oEvent.getSource().getSelectedKey();
      this._loadRunHistory({ range });
    },

    onSelectRun: async function (oEvent) {
      const item = oEvent.getParameter("listItem");
      const ctx = item.getBindingContext("runHistoryModel");
      const runId = ctx?.getProperty("runId");
      if (!runId) return;

      this.selectedRunId = runId;

      const response = await fetch(`/runHistory/${encodeURIComponent(runId)}`);
      const result = await response.json();
      if (!result.success) {
        MessageToast.show(result.error || "Failed to load run detail");
        return;
      }

      const detailModel = new JSONModel(result.data || {});
      detailModel.setDefaultBindingMode("OneWay");
      this.getView().getModel("runHistoryModel");

      // Attach model to detail view and navigate.
      const page = this.getOwnerComponent().getAggregation?.("rootControl")?.byId?.("runHistoryDetailPage");
      // fallback: use global navigation by parent app controller
      const oApp = this.getView().getParent();
      const appController = oApp?.getController?.();
      // If parent is the main App controller, call its navigation.
      if (appController && appController._navToRunHistoryDetail) {
        appController._navToRunHistoryDetail(detailModel);
      }
    }
  });
});

