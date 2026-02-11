import { useState, useEffect, useImperativeHandle, forwardRef, useCallback } from "react";
import { getFindings } from "../../services/api";
import Spinner from "../../shared/Spinner";

type Finding = {
  category: string;
  value: string;
};

export type FindingsPanelHandle = {
  refresh: () => void;
};

const CATEGORY_LABELS: Record<string, string> = {
  symptom: "Symptoms",
  location: "Location",
  onset: "Onset",
  duration: "Duration",
  severity: "Severity",
  character: "Character",
  aggravating_factor: "Aggravating Factors",
  relieving_factor: "Relieving Factors",
  associated_symptom: "Associated Symptoms",
  medical_history: "Medical History",
  medication: "Medications",
  allergy: "Allergies",
};

const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS);

const FindingsPanel = forwardRef<FindingsPanelHandle, { conversationId: string }>(
  ({ conversationId }, ref) => {
    const [findings, setFindings] = useState<Finding[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchFindings = useCallback(async () => {
      try {
        const { data } = await getFindings(conversationId);
        setFindings(data.findings);
      } catch (err) {
        console.error("Failed to load findings", err);
      } finally {
        setLoading(false);
      }
    }, [conversationId]);

    useImperativeHandle(ref, () => ({ refresh: fetchFindings }), [fetchFindings]);

    useEffect(() => {
      fetchFindings();
    }, [fetchFindings]);

    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <Spinner />
        </div>
      );
    }

    const grouped = findings.reduce(
      (acc, f) => {
        if (!acc[f.category]) acc[f.category] = [];
        acc[f.category].push(f.value);
        return acc;
      },
      {} as Record<string, string[]>,
    );

    const categories = CATEGORY_ORDER.filter((cat) => grouped[cat]);

    if (categories.length === 0) {
      return (
        <div className="font-fakt text-sm text-gray-400 p-6">
          No clinical findings recorded yet.
        </div>
      );
    }

    return (
      <div className="p-6 overflow-y-auto h-full">
        <h2 className="font-ddn font-semibold text-xl mb-4">
          Clinical Findings
        </h2>
        <div className="space-y-4">
          {categories.map((cat) => (
            <div key={cat}>
              <h3 className="font-fakt text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                {CATEGORY_LABELS[cat]}
              </h3>
              <ul className="space-y-1">
                {grouped[cat].map((value, i) => (
                  <li
                    key={i}
                    className="font-fakt text-sm text-gray-700 bg-white rounded-lg px-3 py-2"
                  >
                    {value}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    );
  },
);

export default FindingsPanel;
