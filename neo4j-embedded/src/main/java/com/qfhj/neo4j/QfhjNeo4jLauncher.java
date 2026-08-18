package com.qfhj.neo4j;

import org.neo4j.configuration.GraphDatabaseSettings;
import org.neo4j.configuration.connectors.BoltConnector;
import org.neo4j.configuration.connectors.HttpConnector;
import org.neo4j.harness.Neo4j;
import org.neo4j.harness.Neo4jBuilders;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;

public class QfhjNeo4jLauncher {
    public static void main(String[] args) throws Exception {
        Path home = args.length > 0 ? Path.of(args[0]) : Path.of(".").toAbsolutePath().resolve("neo4j-data");
        int boltPort = args.length > 1 ? Integer.parseInt(args[1]) : 7687;
        int httpPort = args.length > 2 ? Integer.parseInt(args[2]) : 7474;
        Files.createDirectories(home);
        Path data = home.resolve("data");
        Files.createDirectories(data);
        System.out.println("[qfhj-neo4j] starting embedded Neo4j at " + LocalDateTime.now());
        System.out.println("[qfhj-neo4j] home=" + home.toAbsolutePath());
        Neo4j neo4j = Neo4jBuilders.newInProcessBuilder(home)
                .withConfig(GraphDatabaseSettings.data_directory, data)
                .withConfig(GraphDatabaseSettings.filewatcher_enabled, false)
                .withConfig(BoltConnector.enabled, true)
                .withConfig(BoltConnector.listen_address, new org.neo4j.configuration.helpers.SocketAddress("127.0.0.1", boltPort))
                .withConfig(HttpConnector.enabled, true)
                .withConfig(HttpConnector.listen_address, new org.neo4j.configuration.helpers.SocketAddress("127.0.0.1", httpPort))
                .build();
        System.out.println("[qfhj-neo4j] ready bolt=" + neo4j.boltURI());
        System.out.println("[qfhj-neo4j] ready http=" + neo4j.httpURI());
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            System.out.println("[qfhj-neo4j] stopping");
            neo4j.close();
        }));
        Thread.currentThread().join();
    }
}
