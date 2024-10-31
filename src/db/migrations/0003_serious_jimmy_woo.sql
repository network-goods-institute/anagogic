CREATE VIEW "public"."point_counterpoints_view" AS (select "newer_point_id", ARRAY_AGG("older_point_id") as "counterpoint_ids" from ((select "newer_point_id", "older_point_id" from "negations") union (select "older_point_id", "newer_point_id" from "negations")) "counterpoints" group by "counterpoints"."newer_point_id");