import { useState, useEffect } from "react";
import { getDiagnoses } from "../../services/api";
import axios from "axios";

type Differential = {
  condition: string;
  confidence: string;
};

type Source = {
  source: string;
  section: string;
  similarity: number;
  condition?: string;
  confidence?: string;
};

const getLastSection = (section: string): string => {
  const parts = section.split(">");
  return parts[parts.length - 1].trim();
};

const getNcbiUrl = (source: string): string | null => {
  const match = source.match(/NBK\d+/);
  return match ? `https://www.ncbi.nlm.nih.gov/books/${match[0]}/` : null;
};

const confidenceStyles: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  moderate: "bg-yellow-100 text-yellow-700",
  low: "bg-gray-100 text-gray-600",
};

const DiagnosisPanel = ({ conversationId }: { conversationId: string }) => {
  const [diagnoses, setDiagnoses] = useState<Differential[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [diagRes, convRes] = await Promise.all([
          getDiagnoses(conversationId),
          axios.get(`/api/conversation/${conversationId}`),
        ]);
        setDiagnoses(diagRes.data.diagnoses);
        setSources(convRes.data.assessmentSources || []);
      } catch (err) {
        console.error("Failed to load diagnoses", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
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
    <div className="overflow-y-auto h-full p-6">
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

      {sources.length > 0 && (
        <>
          <h2 className="font-ddn font-semibold text-xl mt-8 mb-4">
            Sources
          </h2>
          <div className="space-y-2">
            {sources.map((s, i) => (
              <div key={i} className="flex items-center justify-between bg-white rounded-lg px-3 py-2">
                <div>
                  <a
                    href={getNcbiUrl(s.source) || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={s.section}
                    className="font-fakt text-sm text-blue-700 underline hover:text-blue-900 line-clamp-2"
                  >
                    {getLastSection(s.section)}
                  </a>
                  <div className="font-fakt text-xs text-gray-400">{s.section.split(">")[0].trim()}</div>
                  {s.condition && (
                    <div className={`font-fakt text-xs font-medium px-2 py-1 rounded-md mt-1 inline-block ${confidenceStyles[s.confidence || "low"]}`}>{s.condition}</div>
                  )}
                </div>
                <span className="ml-2 px-2 py-1 rounded-md font-fakt text-xs font-medium bg-blue-100 text-blue-700">
                  {Math.round(s.similarity * 100)}%
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default DiagnosisPanel;
