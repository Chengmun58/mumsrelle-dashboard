CREATE TABLE `keyword_imports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`filename` varchar(255),
	`source` varchar(100) NOT NULL,
	`rowCount` int NOT NULL,
	`rows` json NOT NULL,
	`importedByUserId` int NOT NULL,
	`importedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `keyword_imports_id` PRIMARY KEY(`id`)
);
