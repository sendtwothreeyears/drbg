type Differential = {
  condition: string;
  confidence: "high" | "moderate" | "low";
};

type DiagnosisListProps = {
  differentials: Differential[];
};

const confidenceStyles = {
  high: "bg-red-100 text-red-700",
  moderate: "bg-yellow-100 text-yellow-700",
  low: "bg-gray-100 text-gray-600",
};

const DiagnosisList = ({ differentials }: DiagnosisListProps) => {
  return (
    <div className="flex justify-end py-1">
      <div className="max-w-[80%]">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="font-fakt text-sm font-medium text-gray-500 mb-3">
            Differential Diagnoses
          </p>
          <div className="flex flex-col gap-2">
            {differentials.map((d, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg"
              >
                <span className="font-fakt text-base text-gray-900">
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
      </div>
    </div>
  );
};

export default DiagnosisList;
