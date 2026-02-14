import { useState, useEffect } from "react";
import { getDiagnoses } from "../../services/api";

type Differential = {
  condition: string;
  confidence: string;
};

const confidenceStyles: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  moderate: "bg-yellow-100 text-yellow-700",
  low: "bg-gray-100 text-gray-600",
};

const DiagnosisPanel = ({ conversationId }: { conversationId: string }) => {
  const [diagnoses, setDiagnoses] = useState<Differential[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDiagnoses = async () => {
      try {
        const { data } = await getDiagnoses(conversationId);
        setDiagnoses(data.diagnoses);
      } catch (err) {
        console.error("Failed to load diagnoses", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDiagnoses();
  }, [conversationId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="font-fakt text-sm text-gray-400">Loading...</div>
      </div>
    );
  }

  if (diagnoses.length === 0) {
    return (
      <div className="font-fakt text-sm text-gray-400 p-6">
        No differential diagnoses generated yet.
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full">
      <h2 className="font-ddn font-semibold text-xl mb-4">
        Differential Diagnoses
      </h2>
      <div className="space-y-2">
        {diagnoses.map((d, i) => (
          <div
            key={i}
            className="flex items-center justify-between bg-white rounded-lg px-3 py-2"
          >
            <span className="font-fakt text-sm text-gray-700">
              {d.condition}
            </span>
            <span
              className={`px-2 py-1 rounded-md font-fakt text-xs font-medium ${confidenceStyles[d.confidence]}`}
            >
              {d.confidence}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DiagnosisPanel;
