# Stage 1: Build & Publish
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy project files for caching dependency restore layer
COPY KotobaAPI/KotobaAPI.csproj KotobaAPI/
COPY Kotoba.DataAccess/Kotoba.DataAccess.csproj Kotoba.DataAccess/
COPY Utility/Utility.csproj Utility/

# Restore dependencies for KotobaAPI and its project references
RUN dotnet restore KotobaAPI/KotobaAPI.csproj

# Copy all source files
COPY KotobaAPI/ KotobaAPI/
COPY Kotoba.DataAccess/ Kotoba.DataAccess/
COPY Utility/ Utility/

# Build and publish in Release mode
WORKDIR /src/KotobaAPI
RUN dotnet publish KotobaAPI.csproj -c Release -o /app/publish /p:UseAppHost=false

# Stage 2: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

# Standard ASP.NET Core container port
EXPOSE 8080

# Environment defaults
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

# Copy published application from build stage
COPY --from=build /app/publish .

# Run as non-root user for security (built into .NET 8+ container images)
USER $APP_UID

ENTRYPOINT ["dotnet", "KotobaAPI.dll"]
