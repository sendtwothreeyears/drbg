import Spinner from "../../shared/Spinner";

interface LoadingPanelProps {
  title: string;
  subtitle: string;
}

const LoadingPanel = ({ title, subtitle }: LoadingPanelProps) => {
  return (
    <div className="flex flex-col items-center py-8">
      <Spinner />
      <h3 className="font-ddn font-semibold text-xl mt-4 mb-1">
        {title}
      </h3>
      <p className="font-fakt text-gray-500 text-sm">
        {subtitle}
      </p>
    </div>
  );
};

export default LoadingPanel;
