# Build stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy project files for restoring dependencies
COPY ["QuantFloww.API/QuantFloww.API.csproj", "QuantFloww.API/"]
COPY ["QuantFloww.Infrastructure/QuantFloww.Infrastructure.csproj", "QuantFloww.Infrastructure/"]
COPY ["QuantFloww.Application/QuantFloww.Application.csproj", "QuantFloww.Application/"]
COPY ["QuantFloww.Domain/QuantFloww.Domain.csproj", "QuantFloww.Domain/"]

# Restore dependencies
RUN dotnet restore "QuantFloww.API/QuantFloww.API.csproj"

# Copy full source and build
COPY . .
WORKDIR "/src/QuantFloww.API"
RUN dotnet build "QuantFloww.API.csproj" -c Release -o /app/build

# Publish
FROM build AS publish
RUN dotnet publish "QuantFloww.API.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Final production stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=publish /app/publish .

# Expose HTTP port 5280
EXPOSE 5280
ENV ASPNETCORE_URLS=http://+:5280

ENTRYPOINT ["dotnet", "QuantFloww.API.dll"]
