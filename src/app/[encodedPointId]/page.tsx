"use client";
import { format } from "date-fns";

import { endorse } from "@/actions/endorse";
import { fetchFavorHistory } from "@/actions/fetchFavorHistory";
import { fetchPoint } from "@/actions/fetchPoint";
import { fetchPointNegations } from "@/actions/fetchPointNegations";
import { getCounterpointSuggestions } from "@/actions/getCounterpointSuggestions";
import { canvasEnabledAtom } from "@/atoms/canvasEnabledAtom";
import { hoveredPointIdAtom } from "@/atoms/hoveredPointIdAtom";
import { negatedPointIdAtom } from "@/atoms/negatedPointIdAtom";
import { negationContentAtom } from "@/atoms/negationContentAtom";
import { CredInput } from "@/components/CredInput";
import { GraphView } from "@/components/graph/GraphView";
import { EndorseIcon } from "@/components/icons/EndorseIcon";
import { NegateIcon } from "@/components/icons/NegateIcon";
import { NegateDialog } from "@/components/NegateDialog";
import { PointCard } from "@/components/PointCard";
import { PointStats } from "@/components/PointStats";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DEFAULT_TIMESCALE } from "@/constants/config";
import { useCredInput } from "@/hooks/useCredInput";
import { useUser } from "@/hooks/useUser";
import { cn } from "@/lib/cn";
import { decodeId } from "@/lib/decodeId";
import { encodeId } from "@/lib/encodeId";
import { preventDefaultIfContainsSelection } from "@/lib/preventDefaultIfContainsSelection";
import { TimelineScale, timelineScales } from "@/lib/timelineScale";
import { usePrivy } from "@privy-io/react-auth";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useToggle } from "@uidotdev/usehooks";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useAtomCallback } from "jotai/utils";
import {
  ArrowLeftIcon,
  CircleXIcon,
  DiscIcon,
  NetworkIcon,
  SparklesIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, use, useEffect, useState } from "react";
import {
  Dot,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function PointPage({
  params,
}: {
  params: Promise<{ encodedPointId: string }>;
}) {
  const encodedPointId = use(params).encodedPointId;
  const pointId = decodeId(encodedPointId);
  const { user: privyUser, login } = usePrivy();
  const setNegatedPointId = useSetAtom(negatedPointIdAtom);
  const setNegationContent = useAtomCallback(
    (_get, set, negatedPointId: number, content: string) => {
      set(negationContentAtom(negatedPointId), content);
    }
  );

  const [canvasEnabled, setCanvasEnabled] = useAtom(canvasEnabledAtom);

  const {
    data: point,
    refetch: refetchPoint,
    isLoading: isLoadingPoint,
  } = useQuery({
    queryKey: [pointId, "point", privyUser?.id],
    queryFn: () => {
      return fetchPoint(pointId);
    },
  });

  const [timelineScale, setTimelineScale] =
    useState<TimelineScale>(DEFAULT_TIMESCALE);
  const {
    data: favorHistory,
    refetch: refetchFavorHistory,
    isFetching: isFetchingFavorHistory,
  } = useQuery({
    queryKey: [pointId, "favor-history", timelineScale] as const,
    queryFn: ({ queryKey: [pointId, , scale] }) => {
      return fetchFavorHistory({ pointId, scale });
    },
    placeholderData: keepPreviousData,
    refetchInterval: 60000,
  });

  const queryClient = useQueryClient();

  const { data: negations, isLoading: isLoadingNegations } = useQuery({
    queryKey: [pointId, "point-negations", privyUser?.id],
    queryFn: async () => {
      const negations = await fetchPointNegations(pointId);

      for (const negation of negations) {
        queryClient.setQueryData(
          ["point", negation.pointId, privyUser?.id],
          negation
        );
      }

      return negations;
    },
  });

  const endorsedByViewer =
    point?.viewerCred !== undefined && point.viewerCred > 0;

  const hoveredPointId = useAtomValue(hoveredPointIdAtom);

  const { data: user } = useUser();
  const [endorsePopoverOpen, toggleEndorsePopoverOpen] = useToggle(false);
  const {
    credInput: cred,
    setCredInput: setCred,
    notEnoughCred,
  } = useCredInput({
    resetWhen: !endorsePopoverOpen,
  });

  const { back, push } = useRouter();

  const { data: counterpointSuggestionsStream } = useQuery({
    queryKey: ["counterpoint-suggestions", point?.pointId],
    queryFn: ({ queryKey: [, pointId] }) =>
      getCounterpointSuggestions(pointId as number),
    enabled: !!point?.pointId && negations && negations.length === 0,
    staleTime: Infinity,
  });

  const [counterpointSuggestions, setCounterpointSuggestions] = useState<
    string[]
  >([]);

  useEffect(() => {
    if (counterpointSuggestionsStream === undefined) return;

    setCounterpointSuggestions([]);
    let isCancelled = false;

    const consumeStream = async () => {
      const reader = counterpointSuggestionsStream.getReader();
      while (!isCancelled) {
        const { done, value } = await reader.read();
        if (done) break;
        setCounterpointSuggestions((prev) => [...prev, value]);
      }
      reader.releaseLock();
    };

    consumeStream();

    return () => {
      isCancelled = true;
    };
  }, [counterpointSuggestionsStream]);

  return (
    <main
      data-canvas-enabled={canvasEnabled}
      className="relative flex-grow sm:grid sm:grid-cols-[1fr_minmax(200px,600px)_1fr] data-[canvas-enabled=true]:md:grid-cols-[0_minmax(200px,400px)_1fr] bg-background"
    >
      <div className="w-full sm:col-[2] flex flex-col border-x pb-10 overflow-auto">
        {isLoadingPoint && (
          <Loader className="absolute self-center my-auto top-0 bottom-0" />
        )}

        {point && (
          <div className="@container/point relative flex-grow bg-background">
            <div className="sticky top-0 z-10 w-full flex items-center justify-between gap-3 px-4 py-3 bg-background/70 backdrop-blur">
              <div className="flex items-center gap-3">
                <Button
                  variant={"link"}
                  size={"icon"}
                  className="text-foreground -ml-3"
                  onClick={() => {
                    if (window.history.state?.idx > 0) {
                      back();
                      return;
                    }

                    push("/");
                  }}
                >
                  <ArrowLeftIcon />
                </Button>
                <DiscIcon className="shrink-0 size-6 text-muted-foreground stroke-1" />
                <h1 className="text-xl font-medium">Point</h1>
              </div>
              <div className="flex gap-sm items-center text-muted-foreground">
                <Button
                  size={"icon"}
                  variant={canvasEnabled ? "default" : "outline"}
                  className="rounded-full p-2 size-9"
                  onClick={() => setCanvasEnabled(!canvasEnabled)}
                >
                  <NetworkIcon className="" />
                </Button>
                <Popover
                  open={endorsePopoverOpen}
                  onOpenChange={toggleEndorsePopoverOpen}
                >
                  {endorsedByViewer && (
                    <span className="align-middle text-sm text-endorsed">
                      {point.viewerCred} cred
                    </span>
                  )}
                  <PopoverTrigger asChild>
                    <Button
                      className={cn(
                        "p-2 rounded-full size-fit gap-sm hover:bg-endorsed/30",
                        endorsedByViewer && "text-endorsed",
                        "@md/point:border @md/point:px-4"
                      )}
                      onClick={(e) => {
                        if (privyUser === null) {
                          e.preventDefault();
                          login();
                          return;
                        }
                        toggleEndorsePopoverOpen();
                      }}
                      variant={"ghost"}
                    >
                      <EndorseIcon
                        className={cn(
                          "@md/point:hidden",
                          endorsedByViewer && "fill-current"
                        )}
                      />
                      <span className="hidden @md/point:inline">
                        {point.viewerCred ? "Endorsed" : "Endorse"}
                      </span>
                    </Button>
                  </PopoverTrigger>

                  <PopoverContent className="flex flex-col items-start w-96">
                    <div className="w-full flex justify-between">
                      <CredInput
                        credInput={cred}
                        setCredInput={setCred}
                        notEnoughCred={notEnoughCred}
                      />
                      <Button
                        disabled={cred === 0 || notEnoughCred}
                        onClick={() => {
                          endorse({ pointId, cred }).then(() => {
                            refetchPoint();
                            refetchFavorHistory();
                            toggleEndorsePopoverOpen(false);
                          });
                        }}
                      >
                        Endorse
                      </Button>
                    </div>
                    {notEnoughCred && (
                      <span className="ml-md text-destructive text-sm h-fit">
                        not enough cred
                      </span>
                    )}
                  </PopoverContent>
                </Popover>
                <Button
                  variant="ghost"
                  className={cn(
                    "p-2  rounded-full size-fit hover:bg-primary/30",
                    "@md/point:border @md/point:px-4"
                  )}
                  onClick={() =>
                    privyUser !== null
                      ? setNegatedPointId(point.pointId)
                      : login()
                  }
                >
                  <NegateIcon className="@md/point:hidden" />
                  <span className="hidden @md/point:inline">Negate</span>
                </Button>
              </div>
            </div>

            <div
              data-is-hovered={hoveredPointId === pointId}
              className=" px-4 py-3 border-b data-[is-hovered=true]:shadow-[inset_0_0_0_2px_hsl(var(--primary))]"
            >
              <p className="tracking-tight text-md  @xs/point:text-md @sm/point:text-lg mb-sm">
                {point.content}
              </p>
              <span className="text-muted-foreground text-sm">
                {format(point.createdAt, "h':'mm a '·' MMM d',' yyyy")}
              </span>

              <>
                <ResponsiveContainer
                  width="100%"
                  height={100}
                  className={"mt-md"}
                >
                  <LineChart
                    width={300}
                    height={100}
                    data={favorHistory}
                    className="[&>.recharts-surface]:overflow-visible"
                  >
                    <XAxis dataKey="timestamp" hide />
                    <YAxis domain={[0, 100]} hide />
                    <ReferenceLine
                      y={50}
                      className="[&>line]:stroke-muted"
                    ></ReferenceLine>
                    <Line
                      animationDuration={300}
                      dataKey="favor"
                      type="stepAfter"
                      className="overflow-visible text-endorsed"
                      dot={({ key, ...dot }) =>
                        favorHistory &&
                        dot.index === favorHistory.length - 1 ? (
                          <Fragment key={key}>
                            <Dot
                              {...dot}
                              fill={dot.stroke}
                              className="animate-ping"
                              style={{
                                transformOrigin: `${dot.cx}px ${dot.cy}px`,
                              }}
                            />
                            <Dot {...dot} fill={dot.stroke} />
                          </Fragment>
                        ) : (
                          <Fragment key={key} />
                        )
                      }
                      stroke={"currentColor"}
                      strokeWidth={2}
                    />

                    <Tooltip
                      wrapperClassName="backdrop-blur-sm !bg-transparent !pb-0 rounded-sm"
                      labelClassName=" -top-3 text-muted-foreground text-xs"
                      formatter={(value: number) => value.toFixed(2)}
                      labelFormatter={(timestamp: Date) =>
                        timestamp.toLocaleString()
                      }
                      // position={{ y: 0 }}
                      // offset={0}
                    />
                  </LineChart>
                </ResponsiveContainer>
                <ToggleGroup
                  type="single"
                  value={timelineScale}
                  onValueChange={(v) =>
                    v && setTimelineScale(v as TimelineScale)
                  }
                  className="flex gap-px w-fit"
                >
                  {timelineScales.map((scale) => (
                    <ToggleGroupItem
                      value={scale}
                      className="w-10 h-6 text-sm text-muted-foreground"
                      key={scale}
                    >
                      {scale}
                    </ToggleGroupItem>
                  ))}
                  <Loader
                    className="text-muted-foreground size-4 ml-2"
                    style={{
                      display: isFetchingFavorHistory ? "block" : "none",
                    }}
                  />
                </ToggleGroup>
              </>

              <Separator className="my-md" />
              <PointStats
                className="justify-evenly ~@/lg:~text-xs/sm mb-sm"
                favor={point.favor}
                amountNegations={point.amountNegations}
                amountSupporters={point.amountSupporters}
                cred={point.cred}
              />
            </div>
            <div className="relative flex flex-col">
              {isLoadingNegations && (
                <Loader className="absolute left-0 right-0 mx-auto top-[20px] bottom-auto" />
              )}
              {negations &&
                negations.map((negation, i) => (
                  <Link
                    data-is-hovered={hoveredPointId === negation.pointId}
                    draggable={false}
                    onClick={preventDefaultIfContainsSelection}
                    href={`/${encodeId(negation.pointId)}`}
                    key={negation.pointId}
                    className={cn(
                      "flex cursor-pointer  px-4 pt-5 pb-2 border-b hover:bg-accent data-[is-hovered=true]:shadow-[inset_0_0_0_2px_hsl(var(--primary))]"
                    )}
                  >
                    <div className="flex flex-col  items-center">
                      <CircleXIcon className="shrink-0 size-6 no-scaling-stroke stroke-1 text-muted-foreground " />
                    </div>
                    <PointCard
                      onNegate={(e) => {
                        //prevent the link from navigating
                        e.preventDefault();
                        user !== null
                          ? setNegatedPointId(negation.pointId)
                          : login();
                      }}
                      className="flex-grow -mt-3.5 pb-3"
                      favor={negation.favor}
                      content={negation.content}
                      createdAt={negation.createdAt}
                      amountSupporters={negation.amountSupporters}
                      amountNegations={negation.amountNegations}
                      pointId={negation.pointId}
                      cred={negation.cred}
                      viewerContext={{ viewerCred: negation.viewerCred }}
                    />
                  </Link>
                ))}
              {!isLoadingNegations && negations?.length === 0 && (
                <p className="w-full text-center py-md border-b text-muted-foreground">
                  No negations yet
                </p>
              )}

              {counterpointSuggestions.length > 0 && (
                <>
                  <p className="w-full text-center text-muted-foreground text-xs p-4 animate-fade-in">
                    Want to add a negation? Try starting with one of these
                    AI-generated ones{" "}
                    <SparklesIcon className="size-3 inline-block align-baseline" />
                  </p>
                  {counterpointSuggestions.map((suggestion, i) => (
                    <div
                      key={`suggestion-${i}`}
                      className="flex gap-3 mt-3 mx-2 px-3 py-4 rounded-md border border-dashed hover:bg-muted cursor-pointer animate-fade-in"
                      onClick={() => {
                        if (privyUser === null) {
                          login();
                          return;
                        }
                        setNegationContent(pointId, suggestion);
                        setNegatedPointId(point.pointId);
                      }}
                    >
                      <div className="relative grid text-muted-foreground">
                        <CircleXIcon className="shrink-0 size-6 stroke-1 text-muted-foreground col-start-1 row-start-1" />
                      </div>
                      <p className="tracking-tighter text-sm  @sm/point:text-base  -mt-0.5">
                        {suggestion}
                      </p>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}
      </div>
      {canvasEnabled && (
        <GraphView
          closeButtonClassName="md:hidden"
          className="!fixed md:!sticky inset-0 top-[var(--header-height)] md:inset-[reset]  !h-[calc(100vh-var(--header-height))] md:top-[var(--header-height)] md: !z-10 md:z-auto"
          rootPointId={pointId}
          onClose={() => setCanvasEnabled(false)}
        />
      )}

      <NegateDialog />
    </main>
  );
}
