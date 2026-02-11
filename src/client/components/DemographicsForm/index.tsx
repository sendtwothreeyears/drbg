import { useState } from "react";

type DemographicsFormProps = {
  onSubmit: (age: number, biologicalSex: string) => void;
  disabled?: boolean;
};

const DemographicsForm = ({ onSubmit, disabled }: DemographicsFormProps) => {
  const [age, setAge] = useState<string>("");
  const [sex, setSex] = useState<string>("");

  const canSubmit = age && parseInt(age) > 0 && sex && !disabled;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit(parseInt(age), sex);
  };

  return (
    <div className="flex justify-end py-1">
      <div className="max-w-[80%]">
        <div className="flex gap-2">
          <input
            type="number"
            min="18"
            max="120"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            disabled={disabled}
            className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-xl font-fakt text-base focus:outline-none focus:ring-2 focus:ring-slate-400"
            placeholder="Age (18+)"
          />
          <div className="flex bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
            <button
              type="button"
              onClick={() => setSex("female")}
              disabled={disabled}
              className={`px-5 py-3 font-fakt text-base font-medium transition-colors ${
                sex === "female"
                  ? "bg-white text-gray-900"
                  : "text-gray-600 hover:bg-gray-200"
              }`}
            >
              Female
            </button>
            <button
              type="button"
              onClick={() => setSex("male")}
              disabled={disabled}
              className={`px-5 py-3 font-fakt text-base font-medium transition-colors ${
                sex === "male"
                  ? "bg-white text-gray-900"
                  : "text-gray-600 hover:bg-gray-200"
              }`}
            >
              Male
            </button>
          </div>
        </div>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`w-full mt-2 py-3 rounded-xl font-fakt text-base font-medium text-white transition-colors ${
            canSubmit ? "bg-indigo-400 hover:bg-indigo-500" : "bg-gray-300"
          }`}
        >
          Submit
        </button>
      </div>
    </div>
  );
};

export default DemographicsForm;
