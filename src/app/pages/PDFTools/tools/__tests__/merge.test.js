import { describe, it, expect, vi, beforeEach } from "vitest";
import { execute } from "../merge";
import { toast } from "sonner";
vi.mock("sonner", () => ({
    toast: { error: vi.fn() },
}));
const mockApi = {
    merge: vi.fn(),
};
beforeEach(() => {
    vi.clearAllMocks();
});
describe("merge tool", () => {
    it("calls API with correct inputs and returns ok", async () => {
        const fakeRes = { output: "merged.pdf" };
        mockApi.merge.mockResolvedValueOnce(fakeRes);
        const result = await execute(mockApi, ["file1.pdf", "file2.pdf"], "merged.pdf", {});
        expect(mockApi.merge).toHaveBeenCalledWith({ inputs: ["file1.pdf", "file2.pdf"], output: "merged.pdf" });
        expect(result).toEqual({ ok: true, output: "merged.pdf" });
        expect(toast.error).not.toHaveBeenCalled();
    });
    it("shows toast and returns error when API fails", async () => {
        const errorMsg = "Fallo de merge";
        mockApi.merge.mockRejectedValueOnce(new Error(errorMsg));
        const result = await execute(mockApi, ["a.pdf", "b.pdf"], "out.pdf", {});
        expect(mockApi.merge).toHaveBeenCalled();
        expect(toast.error).toHaveBeenCalledWith(errorMsg);
        expect(result).toEqual({ ok: false, error: errorMsg });
    });
});
