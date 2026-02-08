CREATE TABLE `analysis_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`underlyingTicker` varchar(20) NOT NULL,
	`strategyType` enum('long_call','long_put','short_call','short_put','bull_put_spread','bear_call_spread') NOT NULL,
	`analysisSnapshot` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `analysis_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `saved_strategies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`strategyName` varchar(100) NOT NULL,
	`strategyType` enum('long_call','long_put','short_call','short_put','bull_put_spread','bear_call_spread') NOT NULL,
	`underlyingTicker` varchar(20) NOT NULL,
	`underlyingPrice` decimal(10,2),
	`strategyConfig` json NOT NULL,
	`maxProfit` decimal(12,2),
	`maxLoss` decimal(12,2),
	`breakEvenPrice` decimal(10,2),
	`profitProbability` decimal(5,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `saved_strategies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`defaultStrategy` enum('long_call','long_put','short_call','short_put','bull_put_spread','bear_call_spread'),
	`favoriteTickers` json,
	`chartTheme` enum('light','dark') DEFAULT 'light',
	`showGreeks` int DEFAULT 1,
	`showProbability` int DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_preferences_userId_unique` UNIQUE(`userId`)
);
