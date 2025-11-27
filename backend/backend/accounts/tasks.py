from celery import shared_task
import torch
import time


@shared_task
def gpu_stress_test(duration_seconds=20, tensor_size=2048):
    """
    Runs heavy matrix multiplications on the GPU to load it.
    Default: 20 seconds continuous load.
    """

    if not torch.cuda.is_available():
        return "CUDA not available on this machine."

    device = torch.device("cuda")

    # Allocate large tensors on the GPU
    a = torch.randn((tensor_size, tensor_size), device=device)
    b = torch.randn((tensor_size, tensor_size), device=device)

    start = time.time()
    iterations = 0

    while time.time() - start < duration_seconds:
        c = a @ b  # heavy matrix multiplication
        torch.cuda.synchronize()  # ensure GPU actually executes work
        iterations += 1

    return f"Completed {iterations} matrix multiplications of size {tensor_size}x{tensor_size} in {duration_seconds} seconds."
