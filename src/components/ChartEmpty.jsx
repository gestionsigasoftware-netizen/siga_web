import NoResultsIllustration from "./illustrations/NoResultsIllustration";

export default function ChartEmpty({ message }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-2 text-center">
      <NoResultsIllustration className="w-20 h-auto" />
      <p className="text-sm text-muted max-w-[220px]">{message}</p>
    </div>
  );
}
