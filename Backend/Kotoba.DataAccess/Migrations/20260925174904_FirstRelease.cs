using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kotoba.DataAccess.Migrations
{
    /// <inheritdoc />
    public partial class FirstRelease : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsAdmin",
                table: "Users",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "LessonPosition",
                table: "Subjects",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_Subjects_Level_LessonPosition",
                table: "Subjects",
                columns: new[] { "Level", "LessonPosition" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Subjects_Level_LessonPosition",
                table: "Subjects");

            migrationBuilder.DropColumn(
                name: "IsAdmin",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "LessonPosition",
                table: "Subjects");
        }
    }
}
